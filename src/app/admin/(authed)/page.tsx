import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CleanupCard } from "@/components/admin/CleanupCard";
import { ensureMigrated } from "@/db/ensure-migrated";
import { db } from "@/db/drizzle";
import { sql } from "drizzle-orm";
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

interface Stats {
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
  users: { total: number; active7d: number; quotaExhausted: number };
  results: { total: number; saved: number };
  feedback: { total: number; distribution: Record<string, number> };
  trend: Array<{ date: string; total: number; succeeded: number }>;
}

async function loadStats(): Promise<Stats> {
  await ensureMigrated();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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
    .select({ c: sql<number>`count(*)::int` })
    .from(tryonTasks)
    .where(
      sql`${tryonTasks.status} in (${TASK_STATUS.SUCCEEDED}, ${TASK_STATUS.FAILED}, ${TASK_STATUS.TIMEOUT}, ${TASK_STATUS.CANCELLED})`
    );

  const avgDuration = await db
    .select({
      avg: sql<number>`avg(extract(epoch from (${tryonTasks.completedAt} - ${tryonTasks.submittedAt})) * 1000)::float8`,
    })
    .from(tryonTasks)
    .where(
      sql`${tryonTasks.status} = ${TASK_STATUS.SUCCEEDED} and ${tryonTasks.completedAt} is not null and ${tryonTasks.submittedAt} is not null`
    );

  const userStats = await db
    .select({
      total: sql<number>`count(*)::int`,
      active7d: sql<number>`count(*) filter (where ${users.lastSeenAt} >= ${last7d})::int`,
    })
    .from(users);

  const quotaExhausted = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(quota)
    .where(sql`${quota.usedQuota} + ${quota.reservedQuota} >= ${quota.totalQuota}`);

  const resultStats = await db
    .select({
      total: sql<number>`count(*)::int`,
      saved: sql<number>`count(*) filter (where ${tryonResults.isSaved} = true)::int`,
    })
    .from(tryonResults)
    .where(sql`${tryonResults.isDeleted} = false`);

  const feedbackDist = await db
    .select({ level: feedback.helpfulLevel, c: sql<number>`count(*)::int` })
    .from(feedback)
    .groupBy(feedback.helpfulLevel);

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
  const distribution: Record<string, number> = {};
  let feedbackTotal = 0;
  for (const f of feedbackDist) {
    distribution[f.level] = f.c;
    feedbackTotal += f.c;
  }

  return {
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
    results: { total: r?.total ?? 0, saved: r?.saved ?? 0 },
    feedback: { total: feedbackTotal, distribution },
    trend: trendRows.map((row) => ({
      date: row.date,
      total: row.total,
      succeeded: row.succeeded,
    })),
  };
}

function StatCard({
  title,
  value,
  hint,
  tone = "default",
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
      ? "text-amber-600"
      : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${toneClass}`}>{value}</div>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const FEEDBACK_LABELS: Record<string, string> = {
  very_helpful: "很有帮助",
  somewhat_helpful: "有一定帮助",
  not_helpful: "没有帮助",
};

export default async function AdminDashboardPage() {
  let stats: Stats | null = null;
  let loadError: string | null = null;
  try {
    stats = await loadStats();
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  if (loadError) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            加载统计数据失败：{loadError}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Spinner /> 加载中…
      </div>
    );
  }

  const maxTrend = Math.max(1, ...stats.trend.map((t) => t.total));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="今日任务"
          value={String(stats.tasks.today)}
          hint={`累计 ${stats.tasks.total} 个`}
        />
        <StatCard
          title="成功率"
          value={`${stats.tasks.successRate}%`}
          hint={`成功 ${stats.tasks.succeeded} / 失败 ${stats.tasks.failed}`}
          tone={stats.tasks.successRate >= 90 ? "default" : "warning"}
        />
        <StatCard
          title="在途任务"
          value={String(stats.tasks.inFlight)}
          hint={`平均耗时 ${formatDuration(stats.tasks.avgDurationMs)}`}
          tone={stats.tasks.inFlight > 10 ? "warning" : "default"}
        />
        <StatCard
          title="近 24h 失败"
          value={String(stats.tasks.failed24h)}
          tone={stats.tasks.failed24h > 0 ? "danger" : "default"}
        />
      </div>

      {/* Second row */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总用户"
          value={String(stats.users.total)}
          hint={`近 7 天活跃 ${stats.users.active7d}`}
        />
        <StatCard
          title="额度用尽用户"
          value={String(stats.users.quotaExhausted)}
          tone={stats.users.quotaExhausted > 0 ? "warning" : "default"}
        />
        <StatCard
          title="结果图总数"
          value={String(stats.results.total)}
          hint={`已保存 ${stats.results.saved}`}
        />
        <StatCard
          title="反馈数"
          value={String(stats.feedback.total)}
        />
      </div>

      {/* Trend chart */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>近 7 天任务趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.trend.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {stats.trend.map((row) => (
                <div key={row.date} className="flex items-center gap-3 text-sm">
                  <div className="w-24 text-muted-foreground">{row.date}</div>
                  <div className="flex-1">
                    <div className="relative h-6 rounded bg-muted/40">
                      <div
                        className="absolute inset-y-0 left-0 rounded bg-primary/70"
                        style={{
                          width: `${(row.total / maxTrend) * 100}%`,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 rounded bg-emerald-500/70"
                        style={{
                          width: `${
                            (row.succeeded / Math.max(1, maxTrend)) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-24 text-right text-muted-foreground">
                    {row.succeeded}/{row.total}
                  </div>
                </div>
              ))}
              <div className="flex gap-4 pt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded bg-primary/70" />
                  总任务
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded bg-emerald-500/70" />
                  成功
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback distribution */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>反馈分布</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.feedback.total === 0 ? (
            <p className="text-sm text-muted-foreground">暂无反馈</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.feedback.distribution).map(([level, count]) => {
                const pct =
                  stats!.feedback.total > 0
                    ? Math.round((count / stats!.feedback.total) * 100)
                    : 0;
                return (
                  <div key={level} className="flex items-center gap-3 text-sm">
                    <div className="w-24 text-muted-foreground">
                      {FEEDBACK_LABELS[level] ?? level}
                    </div>
                    <div className="flex-1">
                      <div className="h-5 rounded bg-muted/40">
                        <div
                          className="h-5 rounded bg-primary/60"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-20 text-right text-muted-foreground">
                      {count} ({pct}%)
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-3">
        <Link
          href="/admin/tasks"
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          查看任务列表 →
        </Link>
        <Link
          href="/admin/users"
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          查看用户列表 →
        </Link>
      </div>

      {/* Cleanup action */}
      <div className="mt-6">
        <CleanupCard />
      </div>
    </div>
  );
}
