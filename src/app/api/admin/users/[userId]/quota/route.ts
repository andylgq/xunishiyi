import { eq } from "drizzle-orm";
import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { requireAdmin } from "@/app/api/admin/_lib/guard";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/db/drizzle";
import { ensureMigrated } from "@/db/ensure-migrated";
import { quota, taskLogs, tryonTasks, users } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QuotaAdjustBody {
  action: "set_total" | "reset_period";
  value?: number;
}

export const PATCH = apiHandler(async (req, ctx) => {
  await requireAdmin();
  await ensureMigrated();
  const { userId } = await ctx.params;
  if (!userId) throw new NotFoundError("用户不存在");

  let body: QuotaAdjustBody;
  try {
    body = (await req.json()) as QuotaAdjustBody;
  } catch {
    throw new ValidationError("请求体必须是 JSON");
  }

  if (body.action !== "set_total" && body.action !== "reset_period") {
    throw new ValidationError("action 必须是 set_total 或 reset_period");
  }

  // 校验用户存在
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRows[0]) throw new NotFoundError("用户不存在");

  // 校验 quota 行存在
  const quotaRows = await db
    .select()
    .from(quota)
    .where(eq(quota.userId, userId))
    .limit(1);
  if (!quotaRows[0]) throw new NotFoundError("用户额度记录不存在");

  const before = quotaRows[0];

  if (body.action === "set_total") {
    const v = body.value;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 100) {
      throw new ValidationError("value 必须是 1-100 的整数");
    }
    await db
      .update(quota)
      .set({ totalQuota: v, updatedAt: new Date() })
      .where(eq(quota.userId, userId));
  } else {
    // reset_period
    await db
      .update(quota)
      .set({
        usedQuota: 0,
        reservedQuota: 0,
        periodStartAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quota.userId, userId));
  }

  // 记录 admin 操作日志到 task_logs（挂在该用户最近一个任务上；若无则跳过）
  const recentTaskRows = await db
    .select({ id: tryonTasks.id })
    .from(tryonTasks)
    .where(eq(tryonTasks.userId, userId))
    .limit(1);
  if (recentTaskRows[0]) {
    await db.insert(taskLogs).values({
      taskId: recentTaskRows[0].id,
      event: `admin_quota_${body.action}`,
      payload: {
        userId,
        action: body.action,
        before: {
          total: before.totalQuota,
          used: before.usedQuota,
          reserved: before.reservedQuota,
        },
        after:
          body.action === "set_total"
            ? { total: body.value }
            : { used: 0, reserved: 0 },
        ts: new Date().toISOString(),
      } as never,
    });
  }

  const after = await db
    .select()
    .from(quota)
    .where(eq(quota.userId, userId))
    .limit(1);

  return jsonOk({
    ok: true,
    quota: after[0]
      ? {
          total: after[0].totalQuota,
          used: after[0].usedQuota,
          reserved: after[0].reservedQuota,
          periodStartAt: after[0].periodStartAt.toISOString(),
        }
      : null,
  });
});
