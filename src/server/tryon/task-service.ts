import { and, eq, lt, asc } from "drizzle-orm";
import pLimit from "p-limit";

import { db } from "@/db/drizzle";
import { ensureMigrated } from "@/db/ensure-migrated";
import {
  uploads,
  tryonTasks,
  tryonResults,
  taskLogs,
  TASK_STATUS,
  type GarmentType,
} from "@/db/schema";
import { LIMITS } from "@/lib/constants";
import {
  PrecheckError,
  NotFoundError,
  ConflictError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import { storage } from "@/server/storage/storage";
import { signRelativeFileUrl, signAbsoluteFileUrl } from "@/server/storage/signed-url";
import { reserveQuota, commitQuota, releaseQuota, refundQuota } from "@/server/quota/quota-service";
import { getProvider } from "./provider-factory";
import { isProviderTerminal } from "./provider";
import {
  canCancel,
  canManualRetry,
  isTerminal,
  canAutoRetry,
} from "./status-machine";
import { recordEvent, MetricEvent } from "@/server/metrics/collector";

const POLL_MIN_INTERVAL_MS = 2000;
const SUBMIT_CONCURRENCY = 2;

export interface CreateTaskInput {
  userId: string;
  personUploadId: string;
  garmentUploadId: string;
  garmentType: GarmentType;
  originalTaskId?: string;
}

export interface TaskViewResult {
  id: string;
  index: number;
  seed: number | null;
  url: string;
  isSaved: boolean;
}

export interface TaskView {
  id: string;
  status: string;
  garmentType: GarmentType;
  attemptCount: number;
  originalTaskId: string | null;
  createdAt: Date;
  submittedAt: Date | null;
  completedAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  personImageUrl: string | null;
  garmentImageUrl: string | null;
  results: TaskViewResult[];
  quotaCharged: boolean;
}

/** 写入一条任务日志（best-effort，失败仅记日志） */
async function logEvent(taskId: string, event: string, payload?: unknown) {
  try {
    await db.insert(taskLogs).values({ taskId, event, payload: payload as never });
  } catch (e) {
    logger.error("[task-log] insert failed", e);
  }
}

function genSeeds(n: number): number[] {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 2_000_000_000));
}

function resultStorageKey(userId: string, taskId: string, index: number, seed: number | null): string {
  return `results/${userId}/${taskId}/${index}-${seed ?? "x"}.png`;
}

/** 校验某 upload 归属用户、角色、预检通过、未删除、未过期 */
async function assertUploadUsable(
  uploadId: string,
  userId: string,
  role: "person" | "garment"
) {
  const rows = await db
    .select()
    .from(uploads)
    .where(and(eq(uploads.id, uploadId), eq(uploads.userId, userId)))
    .limit(1);
  const u = rows[0];
  if (!u) throw new NotFoundError("上传记录不存在");
  if (u.isDeleted) throw new PrecheckError("图片已删除");
  if (u.role !== role) throw new PrecheckError(`图片角色不匹配（期望 ${role}）`);
  if (!u.precheckPassed) throw new PrecheckError("图片未通过预检");
  if (u.expiresAt.getTime() < Date.now()) throw new PrecheckError("图片已过期，请重新上传");
  return u;
}

/**
 * 创建任务：校验上传 → 预占额度 → 建任务行 → 并发派发 3 子任务 → 提交成功转已用。
 * 派发失败不抛错，任务行标记 failed，前端轮询可见。
 */
export async function createTask(input: CreateTaskInput): Promise<{ taskId: string }> {
  await ensureMigrated();
  const { userId, personUploadId, garmentUploadId, garmentType, originalTaskId } = input;

  // 1. 校验两张上传（不扣额度）
  await assertUploadUsable(personUploadId, userId, "person");
  await assertUploadUsable(garmentUploadId, userId, "garment");

  // 2. 预占额度（失败抛 402）
  await reserveQuota(userId);

  const seeds = genSeeds(LIMITS.RESULT_COUNT);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LIMITS.RESULT_TTL_MS);

  // 3. 建任务行（pending）
  const inserted = await db
    .insert(tryonTasks)
    .values({
      userId,
      personUploadId,
      garmentUploadId,
      garmentType,
      requestedCount: LIMITS.RESULT_COUNT,
      status: TASK_STATUS.PENDING,
      providerName: getProvider().name,
      seeds,
      attemptCount: 0,
      maxAttempts: 1,
      originalTaskId: originalTaskId ?? null,
      quotaCharged: false,
      expiresAt,
    })
    .returning({ id: tryonTasks.id });
  const taskId = inserted[0].id;
  await logEvent(taskId, "created", { originalTaskId });

  // 4. 派发子任务
  try {
    const personUrl = await signAbsoluteFileUrl(personUploadId);
    const garmentUrl = await signAbsoluteFileUrl(garmentUploadId);
    const provider = getProvider();
    const limit = pLimit(SUBMIT_CONCURRENCY);
    const submits = await Promise.all(
      seeds.map((seed) =>
        limit(() =>
          provider.submitTask({
            personImageUrl: personUrl,
            garmentImageUrl: garmentUrl,
            garmentType,
            seed,
            keepHead: true,
          })
        )
      )
    );
    const providerTaskIds = submits.map((s) => s.providerTaskId);

    const submittedAt = new Date();
    await db
      .update(tryonTasks)
      .set({
        status: TASK_STATUS.SUBMITTED,
        providerTaskIds,
        submittedAt,
        lastPolledAt: submittedAt,
        quotaCharged: true,
      })
      .where(eq(tryonTasks.id, taskId));
    await commitQuota(userId);
    await logEvent(taskId, "submitted", { providerTaskIds });
    await recordEvent(MetricEvent.TRYON_CREATED, { userId, taskId });
    return { taskId };
  } catch (err) {
    // 派发失败：标记 failed，释放预占（未 commit）
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[task:${taskId}] submit failed`, err);
    await db
      .update(tryonTasks)
      .set({
        status: TASK_STATUS.FAILED,
        lastErrorCode: "SUBMIT_FAILED",
        lastErrorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(tryonTasks.id, taskId));
    await releaseQuota(userId);
    await logEvent(taskId, "submit_failed", { error: message });
    await recordEvent(MetricEvent.TRYON_FAILED, {
      userId,
      taskId,
      props: { reason: "submit_failed", error: message },
    });
    return { taskId };
  }
}

/** 查询任务详情；若在途且距上次轮询足够久则先推进一次。 */
export async function getTaskWithResults(
  userId: string,
  taskId: string
): Promise<TaskView> {
  await ensureMigrated();
  const rows = await db
    .select()
    .from(tryonTasks)
    .where(and(eq(tryonTasks.id, taskId), eq(tryonTasks.userId, userId)))
    .limit(1);
  const task = rows[0];
  if (!task) throw new NotFoundError("任务不存在");

  // 在途任务：GET 顺带推进（本地 dev 无 cron 也能跑通）
  if (!isTerminal(task.status)) {
    const last = task.lastPolledAt?.getTime() ?? 0;
    if (Date.now() - last >= POLL_MIN_INTERVAL_MS) {
      try {
        await pollAndAdvance(task);
      } catch (e) {
        logger.error(`[task:${taskId}] poll advance failed`, e);
      }
    }
  }

  // 重查最新状态
  const fresh = await db
    .select()
    .from(tryonTasks)
    .where(eq(tryonTasks.id, taskId))
    .limit(1);
  const t = fresh[0] ?? task;

  const resultRows = await db
    .select()
    .from(tryonResults)
    .where(and(eq(tryonResults.taskId, taskId), eq(tryonResults.isDeleted, false)))
    .orderBy(asc(tryonResults.index));

  const results: TaskViewResult[] = [];
  for (const r of resultRows) {
    const url = await signRelativeFileUrl(r.id);
    results.push({
      id: r.id,
      index: r.index,
      seed: r.seed,
      url,
      isSaved: r.isSaved,
    });
  }

  const personImageUrl = await signRelativeFileUrl(t.personUploadId);
  const garmentImageUrl = await signRelativeFileUrl(t.garmentUploadId);

  return {
    id: t.id,
    status: t.status,
    garmentType: t.garmentType as GarmentType,
    attemptCount: t.attemptCount,
    originalTaskId: t.originalTaskId ?? null,
    createdAt: t.createdAt,
    submittedAt: t.submittedAt,
    completedAt: t.completedAt,
    lastErrorCode: t.lastErrorCode,
    lastErrorMessage: t.lastErrorMessage,
    personImageUrl,
    garmentImageUrl,
    results,
    quotaCharged: t.quotaCharged,
  };
}

/**
 * 推进单个任务：超时判定 + 拉取子任务状态 + 下载结果落库。
 * 幂等：终态直接返回。串行调用安全。
 */
export async function pollAndAdvance(task: typeof tryonTasks.$inferSelect): Promise<void> {
  if (isTerminal(task.status)) return;
  const providerTaskIds = task.providerTaskIds ?? [];
  if (providerTaskIds.length === 0) return;

  const now = new Date();

  // 超时判定
  if (
    task.submittedAt &&
    now.getTime() - task.submittedAt.getTime() > LIMITS.TASK_TIMEOUT_MS
  ) {
    await markTimeout(task, now);
    return;
  }

  const provider = getProvider();
  const limit = pLimit(SUBMIT_CONCURRENCY);
  const statuses = await Promise.all(
    providerTaskIds.map((id) => limit(() => provider.getTaskStatus(id)))
  );

  await db
    .update(tryonTasks)
    .set({ lastPolledAt: now })
    .where(eq(tryonTasks.id, task.id));

  const allTerminal = statuses.every((s) => isProviderTerminal(s.status));
  if (!allTerminal) {
    // 任一 done → processing；否则保持 submitted
    const anyDone = statuses.some((s) => s.status === "done");
    if (anyDone && task.status !== TASK_STATUS.PROCESSING) {
      await db
        .update(tryonTasks)
        .set({ status: TASK_STATUS.PROCESSING })
        .where(eq(tryonTasks.id, task.id));
    }
    return;
  }

  // 全部终态：汇总结果
  const doneIndexes = statuses
    .map((s, i) => (s.status === "done" ? i : -1))
    .filter((i) => i >= 0);

  if (doneIndexes.length === 0) {
    // 无一成功 → failed
    const firstErr = statuses.find((s) => s.status === "failed") || statuses[0];
    await markFailed(task, firstErr?.errorCode ?? "ALL_FAILED", firstErr?.errorMessage ?? "全部子任务失败");
    return;
  }

  // 下载成功的子任务结果到自有存储
  for (const idx of doneIndexes) {
    const providerTaskId = providerTaskIds[idx];
    const seed = task.seeds?.[idx] ?? null;
    // 已有结果行则跳过（幂等）
    const exist = await db
      .select({ id: tryonResults.id })
      .from(tryonResults)
      .where(and(eq(tryonResults.taskId, task.id), eq(tryonResults.index, idx)))
      .limit(1);
    if (exist.length > 0) continue;
    try {
      const img = await provider.fetchResultImage(providerTaskId);
      const key = resultStorageKey(task.userId, task.id, idx, seed);
      await storage.save(key, img.buffer, "image/png");
      await db.insert(tryonResults).values({
        taskId: task.id,
        userId: task.userId,
        index: idx,
        seed,
        storageKey: key,
        expiresAt: new Date(now.getTime() + LIMITS.RESULT_TTL_MS),
      });
    } catch (e) {
      logger.error(`[task:${task.id}] result download failed idx=${idx}`, e);
      await logEvent(task.id, "result_download_failed", { index: idx, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const completedAt = new Date();
  await db
    .update(tryonTasks)
    .set({
      status: TASK_STATUS.SUCCEEDED,
      completedAt,
    })
    .where(eq(tryonTasks.id, task.id));
  await logEvent(task.id, "completed", { resultCount: doneIndexes.length });
  const durationMs = task.submittedAt ? completedAt.getTime() - task.submittedAt.getTime() : undefined;
  await recordEvent(MetricEvent.TRYON_SUCCEEDED, {
    userId: task.userId,
    taskId: task.id,
    durationMs,
    props: { resultCount: doneIndexes.length },
  });
}

async function markFailed(
  task: typeof tryonTasks.$inferSelect,
  code: string,
  message: string
) {
  const completedAt = new Date();
  await db
    .update(tryonTasks)
    .set({
      status: TASK_STATUS.FAILED,
      lastErrorCode: code,
      lastErrorMessage: message,
      completedAt,
    })
    .where(eq(tryonTasks.id, task.id));
  if (task.quotaCharged) {
    await refundQuota(task.userId);
  }
  await logEvent(task.id, "failed", { code, message });
  await recordEvent(MetricEvent.TRYON_FAILED, {
    userId: task.userId,
    taskId: task.id,
    props: { reason: code, message },
  });
}

async function markTimeout(task: typeof tryonTasks.$inferSelect, now: Date) {
  // V1 maxAttempts=1：默认不自动重试，直接超时
  if (canAutoRetry(task.attemptCount, task.maxAttempts)) {
    await autoRetry(task);
  } else {
    await db
      .update(tryonTasks)
      .set({
        status: TASK_STATUS.TIMEOUT,
        lastErrorCode: "TIMEOUT",
        lastErrorMessage: `任务超 ${LIMITS.TASK_TIMEOUT_MS / 1000}s 未完成`,
        completedAt: now,
      })
      .where(eq(tryonTasks.id, task.id));
    if (task.quotaCharged) await refundQuota(task.userId);
    await logEvent(task.id, "timeout", {});
    await recordEvent(MetricEvent.TRYON_TIMEOUT, { userId: task.userId, taskId: task.id });
  }
}

/** 自动重试：不扣额度，新建一条任务，originalTaskId 指向当前 */
async function autoRetry(task: typeof tryonTasks.$inferSelect) {
  await db
    .update(tryonTasks)
    .set({
      status: TASK_STATUS.TIMEOUT,
      lastErrorCode: "TIMEOUT_RETRYING",
      completedAt: new Date(),
    })
    .where(eq(tryonTasks.id, task.id));
  if (task.quotaCharged) await refundQuota(task.userId);
  await logEvent(task.id, "auto_retry_scheduled", {});
  // 新建任务（保留额度：refundQuota 已返还，createTask 会重新 reserve，净效果不扣次）
  await createTask({
    userId: task.userId,
    personUploadId: task.personUploadId,
    garmentUploadId: task.garmentUploadId,
    garmentType: task.garmentType as GarmentType,
    originalTaskId: task.id,
  });
}

/** 取消任务：仅 pending/submitted/processing 可取消；返还额度。 */
export async function cancelTask(userId: string, taskId: string): Promise<void> {
  await ensureMigrated();
  const rows = await db
    .select()
    .from(tryonTasks)
    .where(and(eq(tryonTasks.id, taskId), eq(tryonTasks.userId, userId)))
    .limit(1);
  const task = rows[0];
  if (!task) throw new NotFoundError("任务不存在");
  if (!canCancel(task.status)) {
    throw new ConflictError("当前状态不可取消");
  }
  const provider = getProvider();
  if (provider.cancelTask) {
    for (const pid of task.providerTaskIds ?? []) {
      try {
        await provider.cancelTask(pid);
      } catch (e) {
        logger.warn(`[task:${taskId}] cancel provider task failed`, e);
      }
    }
  }
  await db
    .update(tryonTasks)
    .set({ status: TASK_STATUS.CANCELLED, completedAt: new Date() })
    .where(eq(tryonTasks.id, taskId));
  if (task.quotaCharged) {
    await refundQuota(userId);
  } else {
    await releaseQuota(userId);
  }
  await logEvent(taskId, "cancelled", {});
  await recordEvent(MetricEvent.TRYON_CANCELLED, { userId, taskId });
}

/** 手动重试：仅 failed/timeout 可用；扣额度；新建任务。 */
export async function retryTask(
  userId: string,
  taskId: string
): Promise<{ taskId: string }> {
  await ensureMigrated();
  const rows = await db
    .select()
    .from(tryonTasks)
    .where(and(eq(tryonTasks.id, taskId), eq(tryonTasks.userId, userId)))
    .limit(1);
  const task = rows[0];
  if (!task) throw new NotFoundError("任务不存在");
  if (!canManualRetry(task.status)) {
    throw new ConflictError("当前状态不可重试");
  }
  // createTask 会校验 uploads 有效 + 预检通过 + 扣额度
  return createTask({
    userId,
    personUploadId: task.personUploadId,
    garmentUploadId: task.garmentUploadId,
    garmentType: task.garmentType as GarmentType,
    originalTaskId: taskId,
  });
}

/** 删除单张结果（软删 + 清文件 best-effort） */
export async function deleteResult(
  userId: string,
  taskId: string,
  resultId: string
): Promise<void> {
  await ensureMigrated();
  const taskRows = await db
    .select({ id: tryonTasks.id })
    .from(tryonTasks)
    .where(and(eq(tryonTasks.id, taskId), eq(tryonTasks.userId, userId)))
    .limit(1);
  if (!taskRows[0]) throw new NotFoundError("任务不存在");
  const r = await db
    .select()
    .from(tryonResults)
    .where(and(eq(tryonResults.id, resultId), eq(tryonResults.taskId, taskId)))
    .limit(1);
  const result = r[0];
  if (!result) throw new NotFoundError("结果不存在");
  await db
    .update(tryonResults)
    .set({ isDeleted: true })
    .where(eq(tryonResults.id, resultId));
  if (result.storageKey) {
    try {
      await storage.remove(result.storageKey);
    } catch (e) {
      logger.warn("[result] remove file failed", e);
    }
  }
}

/** 清理过期上传（软删 + 删文件） */
export async function cleanupExpiredUploads(): Promise<number> {
  const now = new Date();
  const rows = await db
    .select()
    .from(uploads)
    .where(and(lt(uploads.expiresAt, now), eq(uploads.isDeleted, false)))
    .limit(200);
  for (const u of rows) {
    await db.update(uploads).set({ isDeleted: true }).where(eq(uploads.id, u.id));
    try {
      await storage.remove(u.storageKey);
    } catch {
      /* ignore */
    }
  }
  return rows.length;
}

/** 清理过期结果（软删 + 删文件） */
export async function cleanupExpiredResults(): Promise<number> {
  const now = new Date();
  const rows = await db
    .select()
    .from(tryonResults)
    .where(and(lt(tryonResults.expiresAt, now), eq(tryonResults.isDeleted, false)))
    .limit(200);
  for (const r of rows) {
    await db
      .update(tryonResults)
      .set({ isDeleted: true })
      .where(eq(tryonResults.id, r.id));
    if (r.storageKey) {
      try {
        await storage.remove(r.storageKey);
      } catch {
        /* ignore */
      }
    }
  }
  return rows.length;
}
