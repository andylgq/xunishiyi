import { and, eq } from "drizzle-orm";
import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { getCurrentUserId } from "@/lib/anon-auth";
import { ensureMigrated } from "@/db/ensure-migrated";
import { db } from "@/db/drizzle";
import { feedback, tryonTasks } from "@/db/schema";
import { feedbackSchema } from "@/types/api";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors";
import { recordEvent, MetricEvent } from "@/server/metrics/collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req) => {
  await ensureMigrated();
  const { userId } = await getCurrentUserId();
  const body = await req.json().catch(() => ({}));
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("参数错误", parsed.error.flatten());
  }
  const { taskId, helpfulLevel, reasons, comment } = parsed.data;

  // 校验任务归属
  const taskRows = await db
    .select({ id: tryonTasks.id })
    .from(tryonTasks)
    .where(and(eq(tryonTasks.id, taskId), eq(tryonTasks.userId, userId)))
    .limit(1);
  if (!taskRows[0]) throw new NotFoundError("任务不存在");

  try {
    await db.insert(feedback).values({
      taskId,
      userId,
      helpfulLevel,
      reasons: reasons ?? null,
      comment: comment ?? null,
    });
  } catch (e) {
    // uniqueIndex(23505) 冲突 → 已提交过；其他错误向上抛
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("unique") || msg.includes("23505") || msg.includes("duplicate") || msg.includes("violates")) {
      throw new ConflictError("该任务已提交过反馈");
    }
    throw e;
  }

  await recordEvent(MetricEvent.FEEDBACK_SUBMITTED, {
    userId,
    taskId,
    props: { helpfulLevel, reasons },
  });
  return jsonOk({ ok: true });
});
