import { sql, eq, desc, and, inArray } from "drizzle-orm";
import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { requireAdmin } from "@/app/api/admin/_lib/guard";
import { db } from "@/db/drizzle";
import { ensureMigrated } from "@/db/ensure-migrated";
import { tryonTasks, tryonResults, TASK_STATUS } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TaskRow {
  id: string;
  userId: string;
  status: string;
  garmentType: string;
  providerName: string;
  attemptCount: number;
  lastErrorCode: string | null;
  createdAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  resultCount: number;
}

interface TasksListResponse {
  rows: TaskRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_FILTERS = new Set([
  "all",
  TASK_STATUS.PENDING,
  TASK_STATUS.SUBMITTED,
  TASK_STATUS.PROCESSING,
  TASK_STATUS.SUCCEEDED,
  TASK_STATUS.FAILED,
  TASK_STATUS.TIMEOUT,
  TASK_STATUS.CANCELLED,
]);

export const GET = apiHandler(async (req) => {
  await requireAdmin();
  await ensureMigrated();

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? "20"))
  );
  const status = url.searchParams.get("status") ?? "all";
  const userId = url.searchParams.get("userId");
  if (!STATUS_FILTERS.has(status)) {
    return jsonOk({ rows: [], total: 0, page, pageSize });
  }

  const conds = [];
  if (status !== "all") {
    conds.push(eq(tryonTasks.status, status));
  }
  if (userId) {
    conds.push(eq(tryonTasks.userId, userId));
  }

  // count
  const countQuery = db
    .select({ c: sql<number>`count(*)::int` })
    .from(tryonTasks);
  const countRow =
    conds.length > 0 ? await countQuery.where(and(...conds)) : await countQuery;
  const total = countRow[0]?.c ?? 0;

  // query with result count
  const baseQuery = db
    .select({
      id: tryonTasks.id,
      userId: tryonTasks.userId,
      status: tryonTasks.status,
      garmentType: tryonTasks.garmentType,
      providerName: tryonTasks.providerName,
      attemptCount: tryonTasks.attemptCount,
      lastErrorCode: tryonTasks.lastErrorCode,
      createdAt: tryonTasks.createdAt,
      submittedAt: tryonTasks.submittedAt,
      completedAt: tryonTasks.completedAt,
      resultCount: sql<number>`(
        select count(*)::int from ${tryonResults}
        where ${tryonResults.taskId} = ${tryonTasks.id}
        and ${tryonResults.isDeleted} = false
      )`,
    })
    .from(tryonTasks)
    .orderBy(desc(tryonTasks.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const rows =
    conds.length > 0 ? await baseQuery.where(and(...conds)) : await baseQuery;

  const taskRows: TaskRow[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    status: r.status,
    garmentType: r.garmentType,
    providerName: r.providerName,
    attemptCount: r.attemptCount,
    lastErrorCode: r.lastErrorCode,
    createdAt: r.createdAt.toISOString(),
    submittedAt: r.submittedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    resultCount: r.resultCount ?? 0,
  }));

  const response: TasksListResponse = { rows: taskRows, total, page, pageSize };
  return jsonOk(response);
});
