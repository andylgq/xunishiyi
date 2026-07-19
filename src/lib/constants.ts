/** 客户端可安全导入的常量（不含密钥）。 */
export const LIMITS = {
  MAX_UPLOAD_BYTES: Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024,
  MIN_SHORT_SIDE: Number(process.env.MIN_SHORT_SIDE ?? 512),
  RESULT_COUNT: Number(process.env.RESULT_COUNT ?? 3),
  TASK_TIMEOUT_MS: Number(process.env.TASK_TIMEOUT_SECONDS ?? 120) * 1000,
  DAILY_QUOTA: Number(process.env.DAILY_QUOTA ?? 5),
  UPLOAD_TTL_MS: 24 * 60 * 60 * 1000,
  RESULT_TTL_MS: 24 * 60 * 60 * 1000,
  FILE_TOKEN_TTL_SEC: 60 * 60, // 用户访问图片：1 小时
  PROVIDER_FETCH_TTL_SEC: 30 * 60, // provider 拉取图片：30 分钟
  ANON_INACTIVE_CLEANUP_MS: 7 * 24 * 60 * 60 * 1000,
};

export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ACCEPTED_EXT = [".jpg", ".jpeg", ".png", ".webp"] as const;

export const POLL_INTERVAL_FAST_MS = 2000;
export const POLL_INTERVAL_SLOW_MS = 5000;
export const POLL_FAST_WINDOW_MS = 10_000;
