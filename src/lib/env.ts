/** 仅服务端使用：包含密钥，禁止在客户端组件中导入。 */
import { z } from "zod";

const DEV_PATTERN = /(dev-|change-me|<REPLACE_WITH)/i;

function secretValidation(secret: string, name: string): string {
  if (DEV_PATTERN.test(secret)) {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === "production") {
      throw new Error(
        `[SECURITY ERROR] ${name} contains development placeholder pattern. ` +
          `In production, you MUST replace it with a long random string. ` +
          `Use \`openssl rand -hex 32\` to generate a secure secret.`
      );
    }
    console.warn(
      `[SECURITY WARNING] ${name} contains development placeholder. ` +
        `Replace with a real secret before deploying to production.`
    );
  }
  return secret;
}

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  FILE_TOKEN_SECRET: z
    .string()
    .min(16, "FILE_TOKEN_SECRET 至少 16 字符")
    .transform((s) => secretValidation(s, "FILE_TOKEN_SECRET")),
  CRON_SECRET: z
    .string()
    .min(1)
    .transform((s) => secretValidation(s, "CRON_SECRET")),
  ANON_COOKIE_NAME: z.string().default("tryon_anon_uid"),
  TRYON_PROVIDER: z.enum(["mock", "volcano", "ark"]).default("mock"),
  VOLC_ACCESS_KEY: z.string().optional(),
  VOLC_SECRET_KEY: z.string().optional(),
  VOLC_REGION: z.string().default("cn-north-1"),
  VOLC_SERVICE: z.string().default("cv"),
  VOLC_ENDPOINT: z.string().default("https://visual.volcengineapi.com"),
  VOLC_REQ_KEY: z.string().default("dressing_diffusionV2"),
  ARK_API_KEY: z.string().optional(),
  ADMIN_PASSWORD: z
    .string()
    .min(8, "ADMIN_PASSWORD 至少 8 字符")
    .transform((s) => secretValidation(s, "ADMIN_PASSWORD")),
  ADMIN_SESSION_SECRET: z
    .string()
    .min(32, "ADMIN_SESSION_SECRET 至少 32 字符")
    .transform((s) => secretValidation(s, "ADMIN_SESSION_SECRET")),
  ADMIN_COOKIE_NAME: z.string().default("tryon_admin_session"),
  DAILY_QUOTA: z.coerce.number().int().positive().default(5),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
  MIN_SHORT_SIDE: z.coerce.number().int().positive().default(512),
  RESULT_COUNT: z.coerce.number().int().positive().default(3),
  TASK_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(120),
});

function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const data: Record<string, unknown> = {};
    for (const key of Object.keys(schema.shape)) {
      const v = (process.env as Record<string, string | undefined>)[key];
      if (v !== undefined) data[key] = v;
    }
    return schema.parse({ ...data }) as z.infer<typeof schema>;
  }
  return parsed.data;
}

export const env = loadEnv();
