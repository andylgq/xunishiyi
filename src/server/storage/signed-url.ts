import { signFileToken } from "@/lib/jwt";
import { LIMITS } from "@/lib/constants";

/** 相对 URL，供前端 <img> 使用（同源，带短期 JWT） */
export async function signRelativeFileUrl(
  fileId: string,
  ttlSec: number = LIMITS.FILE_TOKEN_TTL_SEC
): Promise<string> {
  const token = await signFileToken(fileId, ttlSec);
  return `/api/files/${fileId}?token=${token}`;
}

/** 绝对 URL，供第三方 provider 拉取图片（需公网可达；本地 dev 仅 mock 可用） */
export async function signAbsoluteFileUrl(
  fileId: string,
  ttlSec: number = LIMITS.PROVIDER_FETCH_TTL_SEC
): Promise<string> {
  const token = await signFileToken(fileId, ttlSec);
  const base = process.env.APP_URL || "http://localhost:3000";
  return `${base}/api/files/${fileId}?token=${token}`;
}
