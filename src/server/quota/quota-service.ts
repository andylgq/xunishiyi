import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { quota } from "@/db/schema";
import { QuotaExceededError } from "@/lib/errors";

/** 预占额度（原子）。若无剩余抛 QuotaExceededError。 */
export async function reserveQuota(userId: string): Promise<void> {
  const r = await db
    .update(quota)
    .set({ reservedQuota: sql`${quota.reservedQuota} + 1`, updatedAt: new Date() })
    .where(
      and(
        eq(quota.userId, userId),
        sql`(${quota.usedQuota} + ${quota.reservedQuota}) < ${quota.totalQuota}`
      )
    )
    .returning({ userId: quota.userId });
  if (r.length === 0) throw new QuotaExceededError();
}

/** 预占转已用（提交成功后） */
export async function commitQuota(userId: string): Promise<void> {
  await db
    .update(quota)
    .set({
      usedQuota: sql`${quota.usedQuota} + 1`,
      reservedQuota: sql`greatest(${quota.reservedQuota} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(quota.userId, userId));
}

/** 释放预占（预检失败/取消/提交失败） */
export async function releaseQuota(userId: string): Promise<void> {
  await db
    .update(quota)
    .set({
      reservedQuota: sql`greatest(${quota.reservedQuota} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(quota.userId, userId));
}

/** 返还已用额度（provider 失败/超时） */
export async function refundQuota(userId: string): Promise<void> {
  await db
    .update(quota)
    .set({
      usedQuota: sql`greatest(${quota.usedQuota} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(quota.userId, userId));
}

export interface QuotaInfo {
  total: number;
  used: number;
  reserved: number;
  remaining: number;
}

export async function getQuota(userId: string): Promise<QuotaInfo | null> {
  const r = await db
    .select()
    .from(quota)
    .where(eq(quota.userId, userId))
    .limit(1);
  const row = r[0];
  if (!row) return null;
  return {
    total: row.totalQuota,
    used: row.usedQuota,
    reserved: row.reservedQuota,
    remaining: row.totalQuota - row.usedQuota - row.reservedQuota,
  };
}
