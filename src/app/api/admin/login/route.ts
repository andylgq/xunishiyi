import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { AppError, ValidationError } from "@/lib/errors";
import {
  verifyPassword,
  createSessionToken,
  setAdminSessionCookie,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("请求体必须是 JSON");
  }
  const { password } = (body ?? {}) as { password?: string };
  if (typeof password !== "string" || !password) {
    throw new ValidationError("password 不能为空");
  }

  if (!verifyPassword(password)) {
    throw new AppError("INVALID_PASSWORD", "密码错误", 401);
  }

  const token = createSessionToken();
  await setAdminSessionCookie(token);
  return jsonOk({ ok: true });
});
