import { sql } from "drizzle-orm";
import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { requireAdmin } from "@/app/api/admin/_lib/guard";
import { db } from "@/db/drizzle";
import { ensureMigrated } from "@/db/ensure-migrated";
import {
  tryonTasks,
  tryonResults,
  feedback,
  users,
  quota,
  TASK_STATUS,
} from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatsResponse {
  tasks: {
    today: number;
    total: number;
    inFlight: number;
    succeeded: number;
    failed: number;
    failed24h: number;
    successRate: number;
    avgDurationMs: number | null;
  };
  users: {
    total: number;
    active7d: number;
    quotaExhausted: number;
  };
  results: {
    total: number;
    saved: number;
  };
  feedback: {
    total: number;
    distribution: Record<string, number>;
  };
  trend: Array<{ date: string; total: number; succeeded: number }>;
}

export const GET = apiHandler(async () => {
  await requireAdmin();
  await ensureMigrated();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 任务概览
  const taskStats = await db
    .select({
      total: sql<number>`count(*)::int`,
      today: sql<number>`count(*) filter (where ${tryonTasks.createdAt} >= ${todayStart})::int`,
      inFlight: sql<number>`count(*) filter (where ${tryonTasks.status} in (${TASK_STATUS.SUBMITTED}, ${TASK_STATUS.PROCESSING}))::int`,
      succeeded: sql<number>`count(*) filter (where ${tryonTasks.status} = ${TASK_STATUS.SUCCEEDED})::int`,
      failed: sql<number>`count(*) filter (where ${tryonTasks.status} = ${TASK_STATUS.FAILED})::int`,
      failed24h: sql<number>`count(*) filter (where ${tryonTasks.status} = ${TASK_STATUS.FAILED} and ${tryonTasks.completedAt} >= ${last24h})::int`,
    })
    .from(tryonTasks);

  const terminalCount = await db
    .select({
      c: sql<number>`count(*)::int`,
    })
    .from(tryonTasks)
    .where(
      sql`${tryonTasks.status} in (${TASK_STATUS.SUCCEEDED}, ${TASK_STATUS.FAILED}, ${TASK_STATUS.TIMEOUT}, ${TASK_STATUS.CANCELLED})`
    );

  const avgDuration = await db
    .select({
      avg: sql<number>`avg(extract(epoch from (${tryonTasks.completedAt} - ${tryonTasks.submittedAt})) * 1000)::float8`,
    })
    .from(tryonTasks)
    .where(sql`${tryonTasks.status} = ${TASK_STATUS.SUCCEEDED} and ${tryonTasks.completedAt} is not null and ${tryonTasks.submittedAt} is not null`);

  // 用户概览
  const userStats = await db
    .select({
      total: sql<number>`count(*)::int`,
      active7d: sql<number>`count(*) filter (where ${users.lastSeenAt} >= ${last7d})::int`,
    })
    .from(users);

  const quotaExhausted = await db
    .select({
      c: sql<number>`count(*)::int`,
    })
    .from(quota)
    .where(sql`${quota.usedQuota} + ${quota.reservedQuota} >= ${quota.totalQuota}`);

  // 结果概览
  const resultStats = await db
    .select({
      total: sql<number>`count(*)::int`,
      saved: sql<number>`count(*) filter (where ${tryonResults.isSaved} = true)::int`,
    })
    .from(tryonResults)
    .where(sql`${tryonResults.isDeleted} = false`);

  // 反馈分布
  const feedbackDist = await db
    .select({
      level: feedback.helpfulLevel,
      c: sql<number>`count(*)::int`,
    })
    .from(feedback)
    .groupBy(feedback.helpfulLevel);

  const feedbackTotal = feedbackDist.reduce((s, r) => s + r.c, 0);
  const distribution: Record<string, number> = {};
  for (const r of feedbackDist) {
    distribution[r.level] = r.c;
  }

  // 近 7 天趋势
  const trendRows = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${tryonTasks.createdAt}), 'YYYY-MM-DD')`,
      total: sql<number>`count(*)::int`,
      succeeded: sql<number>`count(*) filter (where ${tryonTasks.status} = ${TASK_STATUS.SUCCEEDED})::int`,
    })
    .from(tryonTasks)
    .where(sql`${tryonTasks.createdAt} >= ${last7d}`)
    .groupBy(sql`date_trunc('day', ${tryonTasks.createdAt})`)
    .orderBy(sql`date_trunc('day', ${tryonTasks.createdAt})`);

  const t = taskStats[0];
  const term = terminalCount[0]?.c ?? 0;
  const u = userStats[0];
  const r = resultStats[0];

  const response: StatsResponse = {
    tasks: {
      total: t?.total ?? 0,
      today: t?.today ?? 0,
      inFlight: t?.inFlight ?? 0,
      succeeded: t?.succeeded ?? 0,
      failed: t?.failed ?? 0,
      failed24h: t?.failed24h ?? 0,
      successRate: term > 0 ? Math.round(((t?.succeeded ?? 0) / term) * 1000) / 10 : 0,
      avgDurationMs: avgDuration[0]?.avg ?? null,
    },
    users: {
      total: u?.total ?? 0,
      active7d: u?.active7d ?? 0,
      quotaExhausted: quotaExhausted[0]?.c ?? 0,
    },
    results: {
      total: r?.total ?? 0,
      saved: r?.saved ?? 0,
    },
    feedback: {
      total: feedbackTotal,
      distribution,
    },
    trend: trendRows.map((row) => ({
      date: row.date,
      total: row.total,
      succeeded: row.succeeded,
    })),
  };

  return jsonOk(response);
});
