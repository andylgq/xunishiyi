import { sql, eq, desc, and, gte, lt } from "drizzle-orm";
import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { requireAdmin } from "@/app/api/admin/_lib/guard";
import { ValidationError } from "@/lib/errors";
import { db } from "@/db/drizzle";
import { ensureMigrated } from "@/db/ensure-migrated";
import { users, quota } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  anonUid: string;
  isAnonymous: boolean;
  email: string | null;
  createdAt: string;
  lastSeenAt: string;
  quota: {
    total: number;
    used: number;
    reserved: number;
    periodStartAt: string;
  } | null;
}

interface UsersListResponse {
  rows: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export const GET = apiHandler(async (req) => {
  await requireAdmin();
  await ensureMigrated();

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? "20"))
  );
  const filter = url.searchParams.get("filter"); // "exhausted" | "active7d" | null

  const now = new Date();
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 计数
  const countWhere = [];
  if (filter === "exhausted") {
    countWhere.push(
      sql`${quota.usedQuota} + ${quota.reservedQuota} >= ${quota.totalQuota}`
    );
  } else if (filter === "active7d") {
    countWhere.push(gte(users.lastSeenAt, last7d));
  }

  const countQuery = db
    .select({ c: sql<number>`count(distinct ${users.id})::int` })
    .from(users)
    .leftJoin(quota, eq(users.id, quota.userId));

  const countRow =
    countWhere.length > 0
      ? await countQuery.where(and(...countWhere))
      : await countQuery;

  const total = countRow[0]?.c ?? 0;

  // 查询（left join quota）
  const baseQuery = db
    .select({
      id: users.id,
      anonUid: users.anonUid,
      isAnonymous: users.isAnonymous,
      email: users.email,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
      totalQuota: quota.totalQuota,
      usedQuota: quota.usedQuota,
      reservedQuota: quota.reservedQuota,
      periodStartAt: quota.periodStartAt,
    })
    .from(users)
    .leftJoin(quota, eq(users.id, quota.userId))
    .orderBy(desc(users.lastSeenAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const rows =
    countWhere.length > 0 ? await baseQuery.where(and(...countWhere)) : await baseQuery;

  const userRows: UserRow[] = rows.map((r) => ({
    id: r.id,
    anonUid: r.anonUid,
    isAnonymous: r.isAnonymous,
    email: r.email,
    createdAt: r.createdAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
    quota:
      r.totalQuota == null || r.periodStartAt == null
        ? null
        : {
            total: r.totalQuota,
            used: r.usedQuota ?? 0,
            reserved: r.reservedQuota ?? 0,
            periodStartAt: r.periodStartAt.toISOString(),
          },
  }));

  const response: UsersListResponse = {
    rows: userRows,
    total,
    page,
    pageSize,
  };
  return jsonOk(response);
});
