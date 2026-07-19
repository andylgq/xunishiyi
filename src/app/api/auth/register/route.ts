import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { register, type RegisterInput } from "@/lib/auth";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";

type RegisterRequest = RegisterInput & {
  turnstileToken?: string;
};

export const POST = apiHandler(async (req) => {
  const body = (await req.json()) as RegisterRequest;
  const remoteIp =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await verifyTurnstileToken(body.turnstileToken, remoteIp);
  const user = await register({ email: body.email, password: body.password });
  return jsonOk({
    userId: user.userId,
    email: user.email,
    isAnonymous: user.isAnonymous,
  });
});
