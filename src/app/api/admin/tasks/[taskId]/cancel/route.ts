import { eq } from "drizzle-orm";
import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { requireAdmin } from "@/app/api/admin/_lib/guard";
import { NotFoundError, ConflictError, AppError } from "@/lib/errors";
import { db } from "@/db/drizzle";
import { ensureMigrated } from "@/db/ensure-migrated";
import { tryonTasks, taskLogs, TASK_STATUS } from "@/db/schema";
import { cancelTask } from "@/server/tryon/task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 分钟

export const POST = apiHandler(async (req, ctx) => {
  await requireAdmin();
  await ensureMigrated();
  const { taskId } = await ctx.params;
  if (!taskId) throw new NotFoundError("任务不存在");

  const rows = await db
    .select()
    .from(tryonTasks)
    .where(eq(tryonTasks.id, taskId))
    .limit(1);
  const task = rows[0];
  if (!task) throw new NotFoundError("任务不存在");

  if (
    task.status !== TASK_STATUS.SUBMITTED &&
    task.status !== TASK_STATUS.PROCESSING
  ) {
    throw new ConflictError(
      `仅 submitted/processing 状态可取消，当前状态：${task.status}`
    );
  }

  // Stale 检查：lastPolledAt ?? submittedAt ?? createdAt 必须超过 5 分钟前
  const reference = task.lastPolledAt ?? task.submittedAt ?? task.createdAt;
  const ageMs = Date.now() - reference.getTime();
  if (ageMs < STALE_THRESHOLD_MS) {
    throw new AppError(
      "TASK_NOT_STALE",
      `任务未卡住（最近 ${Math.floor(ageMs / 1000)}s 内有轮询/提交），暂不可强制取消`,
      409
    );
  }

  // 调用现有 cancelTask（含 provider cancel + 额度返还 + 事件记录）
  await cancelTask(task.userId, taskId);

  // 追加一条 admin 取消日志
  await db.insert(taskLogs).values({
    taskId,
    event: "admin_cancelled",
    payload: {
      staleMs: ageMs,
      lastStatus: task.status,
      ts: new Date().toISOString(),
    } as never,
  });

  return jsonOk({ ok: true, taskId, status: TASK_STATUS.CANCELLED });
});
