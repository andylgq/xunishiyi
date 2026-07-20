import { and, eq } from "drizzle-orm";
import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { getCurrentUserId } from "@/lib/anon-auth";
import { ensureMigrated } from "@/db/ensure-migrated";
import { db } from "@/db/drizzle";
import { uploads } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { storage } from "@/server/storage/storage";
import { runPrecheck, type PrecheckInput } from "@/server/precheck";
import { signRelativeFileUrl } from "@/server/storage/signed-url";
import { recordEvent, MetricEvent } from "@/server/metrics/collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req) => {
  await ensureMigrated();
  const { userId } = await getCurrentUserId();
  const body = await req.json().catch(() => ({}));
  const uploadId = (body as { uploadId?: string })?.uploadId;
  if (typeof uploadId !== "string") {
    throw new ValidationError("缺少 uploadId");
  }

  const rows = await db
    .select()
    .from(uploads)
    .where(and(eq(uploads.id, uploadId), eq(uploads.userId, userId)))
    .limit(1);
  const upload = rows[0];
  if (!upload) throw new NotFoundError("上传记录不存在");
  if (upload.isDeleted) throw new NotFoundError("上传记录已删除");

  const buffer = await storage.read(upload.storageKey);
  if (!buffer) throw new NotFoundError("图片文件不存在，请重新上传");

  const input: PrecheckInput = {
    contentType: upload.contentType,
    sizeBytes: upload.sizeBytes,
    buffer,
    role: upload.role as "person" | "garment",
  };
  const result = await runPrecheck(input);

  await db
    .update(uploads)
    .set({
      precheckPassed: result.passed,
      precheckResult: result as unknown as Record<string, unknown>,
    })
    .where(eq(uploads.id, uploadId));

  await recordEvent(MetricEvent.PRECHECK_RUN, {
    userId,
    props: { role: upload.role, passed: result.passed },
  });
  if (result.passed) {
    await recordEvent(MetricEvent.PRECHECK_PASSED, {
      userId,
      props: { role: upload.role },
    });
  }

  const previewUrl = result.passed
    ? await signRelativeFileUrl(uploadId)
    : undefined;

  return jsonOk({
    passed: result.passed,
    checks: result.checks,
    summary: result.summary,
    previewUrl,
  });
});
