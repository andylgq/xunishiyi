import { SignJWT, jwtVerify } from "jose";

const encoder = new TextEncoder();
function getSecret(): Uint8Array {
  const s = process.env.FILE_TOKEN_SECRET;
  if (!s || s.length < 16) {
    throw new Error("FILE_TOKEN_SECRET 未配置或过短");
  }
  return encoder.encode(s);
}

export async function signFileToken(
  fileId: string,
  ttlSec: number
): Promise<string> {
  return new SignJWT({ fileId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .sign(getSecret());
}

export async function verifyFileToken(
  token: string
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const fileId = (payload as { fileId?: string }).fileId;
    return typeof fileId === "string" ? fileId : null;
  } catch {
    return null;
  }
}
