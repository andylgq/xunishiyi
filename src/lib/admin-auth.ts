/**
 * Admin 后台会话鉴权。
 *
 * 设计：
 *   - Token 格式：base64url(payloadJson).base64url(hmacSig)
 *   - payload: { exp: number }（Unix 秒，签发时间 + 7 天）
 *   - HMAC-SHA256(secret, payloadB64)，校验时恒定时间比对
 *
 * Cookie 配置：httpOnly + sameSite=lax + path=/ + 7 天；生产环境 secure=true。
 */
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";
import { AppError } from "./errors";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 天

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function hmacSign(payloadB64: string): string {
  return crypto
    .createHmac("sha256", env.ADMIN_SESSION_SECRET)
    .update(payloadB64, "utf8")
    .digest("base64url");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** 签发 admin session token（不写 cookie，由调用方决定）。 */
export function createSessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payloadB64 = b64url(JSON.stringify({ exp }));
  const sig = hmacSign(payloadB64);
  return `${payloadB64}.${sig}`;
}

/** 校验 token 签名 + 过期时间。失败返回 false（不抛错，便于 middleware/layout 静默重定向）。 */
export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expectedSig = hmacSign(payloadB64);
  if (!timingSafeEqualStr(sig, expectedSig)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/** 校验明文密码是否匹配 env.ADMIN_PASSWORD。 */
export function verifyPassword(password: string): boolean {
  return timingSafeEqualStr(password, env.ADMIN_PASSWORD);
}

/** 服务端组件/Route Handler 中：写入 admin session cookie。 */
export async function setAdminSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(env.ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    secure: env.NODE_ENV === "production",
  });
}

/** 清除 admin session cookie。 */
export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(env.ADMIN_COOKIE_NAME);
}

/**
 * 服务端组件鉴权：读 cookie → 校验 → 失败抛 AppError(401)。
 * 适用于 /api/admin/* 路由首行调用。
 */
export async function requireAdmin(): Promise<void> {
  const store = await cookies();
  const token = store.get(env.ADMIN_COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    throw new AppError("UNAUTHORIZED", "需要管理员登录", 401);
  }
}

/**
 * 服务端组件鉴权（用于 admin/layout.tsx）：失败返回 false（由调用方 redirect）。
 * 与 requireAdmin 的区别是不抛错，便于页面层做 redirect 而非显示错误。
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(env.ADMIN_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
