import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { db } from "@/db/drizzle";
import { ensureMigrated } from "@/db/ensure-migrated";
import { users, quota } from "@/db/schema";
import { LIMITS } from "./constants";
import { ValidationError, ConflictError, NotFoundError, UnauthorizedError } from "./errors";

const scryptAsync = promisify(scrypt);

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME ?? "tryon_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export interface CurrentUser {
  userId: string;
  anonUid: string;
  isAnonymous: boolean;
  email: string | null;
  isNew: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(derivedKey, Buffer.from(key, "hex"));
}

function generateSessionToken(): string {
  return nanoid(32);
}

export async function register(input: RegisterInput): Promise<CurrentUser> {
  await ensureMigrated();

  if (!input.email || !input.email.includes("@")) {
    throw new ValidationError("请输入有效的邮箱地址");
  }
  if (!input.password || input.password.length < 6) {
    throw new ValidationError("密码至少需要 6 个字符");
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing[0]) {
    throw new ConflictError("该邮箱已被注册");
  }

  const passwordHash = await hashPassword(input.password);
  const anonUid = nanoid();

  const created = await db
    .insert(users)
    .values({
      anonUid,
      isAnonymous: false,
      email: input.email,
      passwordHash,
    })
    .returning({ id: users.id, anonUid: users.anonUid });

  await db
    .insert(quota)
    .values({ userId: created[0].id, totalQuota: LIMITS.DAILY_QUOTA })
    .onConflictDoNothing();

  const sessionToken = generateSessionToken();
  const store = await cookies();
  store.set(AUTH_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  return {
    userId: created[0].id,
    anonUid: created[0].anonUid,
    isAnonymous: false,
    email: input.email,
    isNew: true,
  };
}

export async function login(input: LoginInput): Promise<CurrentUser> {
  await ensureMigrated();

  if (!input.email || !input.password) {
    throw new ValidationError("请输入邮箱和密码");
  }

  const rows = await db
    .select({
      id: users.id,
      anonUid: users.anonUid,
      isAnonymous: users.isAnonymous,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  const user = rows[0];
  if (!user || !user.passwordHash) {
    throw new NotFoundError("邮箱或密码错误");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new NotFoundError("邮箱或密码错误");
  }

  const sessionToken = generateSessionToken();
  const store = await cookies();
  store.set(AUTH_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  await db
    .update(users)
    .set({ lastSeenAt: new Date() })
    .where(eq(users.id, user.id));

  return {
    userId: user.id,
    anonUid: user.anonUid,
    isAnonymous: false,
    email: user.email ?? null,
    isNew: false,
  };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: -1,
  });
}

export async function getCurrentUser(): Promise<CurrentUser> {
  await ensureMigrated();
  const store = await cookies();

  const authCookie = store.get(AUTH_COOKIE)?.value;
  if (authCookie) {
    const rows = await db
      .select({
        id: users.id,
        anonUid: users.anonUid,
        isAnonymous: users.isAnonymous,
        email: users.email,
      })
      .from(users)
      .where(eq(users.anonUid, authCookie))
      .limit(1);

    if (rows[0]) {
      await db
        .update(users)
        .set({ lastSeenAt: new Date() })
        .where(eq(users.id, rows[0].id));

      return {
        userId: rows[0].id,
        anonUid: rows[0].anonUid,
        isAnonymous: rows[0].isAnonymous,
        email: rows[0].email ?? null,
        isNew: false,
      };
    }
  }

  let anonUid = store.get("tryon_anon_uid")?.value;
  let isNew = false;

  if (!anonUid) {
    anonUid = nanoid();
    isNew = true;
    store.set("tryon_anon_uid", anonUid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  const rows = await db
    .select({
      id: users.id,
      isAnonymous: users.isAnonymous,
      email: users.email,
    })
    .from(users)
    .where(eq(users.anonUid, anonUid))
    .limit(1);

  if (rows[0]) {
    await db
      .update(users)
      .set({ lastSeenAt: new Date() })
      .where(eq(users.id, rows[0].id));

    return {
      userId: rows[0].id,
      anonUid,
      isAnonymous: rows[0].isAnonymous,
      email: rows[0].email ?? null,
      isNew,
    };
  }

  const created = await db
    .insert(users)
    .values({ anonUid, isAnonymous: true })
    .returning({ id: users.id });

  await db
    .insert(quota)
    .values({ userId: created[0].id, totalQuota: LIMITS.DAILY_QUOTA })
    .onConflictDoNothing();

  return {
    userId: created[0].id,
    anonUid,
    isAnonymous: true,
    email: null,
    isNew,
  };
}

export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.userId;
}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user.isAnonymous) {
    throw new UnauthorizedError();
  }
  return user;
}
