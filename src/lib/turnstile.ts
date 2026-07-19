import { ValidationError } from "./errors";

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp?: string
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    throw new ValidationError("人机验证服务未配置");
  }
  if (!token) {
    throw new ValidationError("请先完成人机验证");
  }

  const form = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteIp) {
    form.set("remoteip", remoteIp);
  }

  let data: TurnstileVerifyResponse;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    data = (await res.json()) as TurnstileVerifyResponse;
  } catch {
    throw new ValidationError("人机验证暂时不可用，请稍后重试");
  }

  if (!data.success) {
    throw new ValidationError("人机验证失败，请重试", data["error-codes"]);
  }
}
