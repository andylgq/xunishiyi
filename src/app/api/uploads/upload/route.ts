import { and, eq } from "drizzle-orm";
import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { getCurrentUserId } from "@/lib/anon-auth";
import { ensureMigrated } from "@/db/ensure-migrated";
import { db } from "@/db/drizzle";
import { uploads } from "@/db/schema";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { ACCEPTED_MIME, LIMITS } from "@/lib/constants";
import { storage } from "@/server/storage/storage";
import { getImageMeta } from "@/server/precheck/rules-engine";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req) => {
  await ensureMigrated();
  const { userId } = await getCurrentUserId();

  const form = await req.formData();
  const file = form.get("file");
  const uploadId = form.get("uploadId");
  if (!(file instanceof File) || typeof uploadId !== "string") {
    throw new ValidationError("缺少 file 或 uploadId");
  }
  if (file.size > LIMITS.MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `图片不能超过 ${LIMITS.MAX_UPLOAD_BYTES / 1024 / 1024}MB`
    );
  }
  const contentType = file.type;
  if (!(ACCEPTED_MIME as readonly string[]).includes(contentType)) {
    throw new ValidationError("仅支持 JPG / PNG / WebP 格式");
  }

  const rows = await db
    .select()
    .from(uploads)
    .where(and(eq(uploads.id, uploadId), eq(uploads.userId, userId)))
    .limit(1);
  const upload = rows[0];
  if (!upload) throw new NotFoundError("上传记录不存在");
  if (upload.isDeleted) throw new NotFoundError("上传记录已删除");

  const buf = Buffer.from(await file.arrayBuffer());
  await storage.save(upload.storageKey, buf, contentType);

  const meta = await getImageMeta(buf);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

  await db
    .update(uploads)
    .set({
      contentType,
      sizeBytes: file.size,
      width: meta.width ?? null,
      height: meta.height ?? null,
      sha256,
    })
    .where(eq(uploads.id, uploadId));

  return jsonOk({
    uploadId,
    width: meta.width ?? null,
    height: meta.height ?? null,
    sizeBytes: file.size,
  });
});
