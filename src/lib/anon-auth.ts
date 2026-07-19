import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { ensureMigrated } from "@/db/ensure-migrated";
import { users, quota } from "@/db/schema";
import { LIMITS } from "./constants";

const ANON_COOKIE = process.env.ANON_COOKIE_NAME ?? "tryon_anon_uid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

export interface CurrentUser {
  userId: string;
  anonUid: string;
  isNew: boolean;
}

/** 获取或创建匿名用户身份（基于 cookie）。每次调用都会刷新 last_seen_at。 */
export async function getCurrentUserId(): Promise<CurrentUser> {
  await ensureMigrated();
  const store = await cookies();
  let anonUid = store.get(ANON_COOKIE)?.value;
  let isNew = false;
  if (!anonUid) {
    anonUid = nanoid();
    isNew = true;
    store.set(ANON_COOKIE, anonUid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.anonUid, anonUid))
    .limit(1);
  if (rows[0]) {
    await db
      .update(users)
      .set({ lastSeenAt: new Date() })
      .where(eq(users.id, rows[0].id));
    return { userId: rows[0].id, anonUid, isNew };
  }

  const created = await db
    .insert(users)
    .values({ anonUid, isAnonymous: true })
    .returning({ id: users.id });
  // 创建额度行（已存在则忽略）
  await db
    .insert(quota)
    .values({ userId: created[0].id, totalQuota: LIMITS.DAILY_QUOTA })
    .onConflictDoNothing();
  return { userId: created[0].id, anonUid, isNew };
}

/** 仅校验 cookie，不创建用户。用于不需要新建会话的场景。 */
export async function getUserIdIfExists(): Promise<string | null> {
  const store = await cookies();
  const anonUid = store.get(ANON_COOKIE)?.value;
  if (!anonUid) return null;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.anonUid, anonUid))
    .limit(1);
  return rows[0]?.id ?? null;
}
