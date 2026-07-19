import sharp from "sharp";
import { ACCEPTED_MIME, LIMITS } from "@/lib/constants";

export interface Check {
  name: string;
  passed: boolean;
  reason?: string;
  severity?: "block" | "warn";
}

export interface PrecheckInput {
  contentType: string;
  sizeBytes: number;
  buffer: Buffer;
  role: "person" | "garment";
}

export interface ImageMeta {
  width?: number;
  height?: number;
}

const SHARPNESS_THRESHOLD = 80; // 启发式阈值，需结合实际样本调整

export async function getImageMeta(buf: Buffer): Promise<ImageMeta> {
  const m = await sharp(buf).metadata();
  return { width: m.width, height: m.height };
}

export async function runBaseRules(input: PrecheckInput): Promise<Check[]> {
  const checks: Check[] = [];

  const formatOk = (ACCEPTED_MIME as readonly string[]).includes(
    input.contentType
  );
  checks.push({
    name: "format",
    passed: formatOk,
    reason: formatOk ? undefined : "仅支持 JPG / PNG / WebP 格式",
  });

  const sizeOk = input.sizeBytes <= LIMITS.MAX_UPLOAD_BYTES;
  checks.push({
    name: "size",
    passed: sizeOk,
    reason: sizeOk
      ? undefined
      : `图片不能超过 ${LIMITS.MAX_UPLOAD_BYTES / 1024 / 1024}MB`,
  });

  let meta: sharp.Metadata | null = null;
  try {
    meta = await sharp(input.buffer).metadata();
  } catch {
    meta = null;
  }
  const intactOk = !!meta;
  checks.push({
    name: "intact",
    passed: intactOk,
    reason: intactOk ? undefined : "图片已损坏或无法解码",
  });

  if (meta?.width && meta?.height) {
    const shortSide = Math.min(meta.width, meta.height);
    const resOk = shortSide >= LIMITS.MIN_SHORT_SIDE;
    checks.push({
      name: "resolution",
      passed: resOk,
      reason: resOk
        ? undefined
        : `短边需 ≥ ${LIMITS.MIN_SHORT_SIDE}px，当前 ${shortSide}px`,
    });
  }

  let sharpness = 0;
  try {
    sharpness = await laplacianVariance(input.buffer);
  } catch {
    sharpness = 0;
  }
  const sharpOk = sharpness >= SHARPNESS_THRESHOLD;
  checks.push({
    name: "sharpness",
    passed: sharpOk,
    reason: sharpOk
      ? undefined
      : `图片可能过于模糊（清晰度 ${sharpness.toFixed(0)}）`,
  });

  return checks;
}

async function laplacianVariance(buf: Buffer): Promise<number> {
  const { data } = await sharp(buf)
    .resize(256, 256, { fit: "inside" })
    .greyscale()
    .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let mean = 0;
  for (let i = 0; i < data.length; i++) mean += data[i];
  mean /= data.length;
  let v = 0;
  for (let i = 0; i < data.length; i++) v += (data[i] - mean) ** 2;
  v /= data.length;
  return v;
}
