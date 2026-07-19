import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { getCurrentUserId } from "@/lib/anon-auth";
import { ensureMigrated } from "@/db/ensure-migrated";
import { db } from "@/db/drizzle";
import { uploads, UPLOAD_ROLE } from "@/db/schema";
import { ValidationError } from "@/lib/errors";
import { LIMITS } from "@/lib/constants";
import { initiateUploadSchema } from "@/types/api";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req) => {
  await ensureMigrated();
  const { userId } = await getCurrentUserId();
  const body = await req.json();
  const parsed = initiateUploadSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("参数错误", parsed.error.flatten());
  }
  const { role, contentType, sizeBytes } = parsed.data;

  const storageKey = `${userId}/${role}/${nanoid(16)}`;
  const now = new Date();
  const inserted = await db
    .insert(uploads)
    .values({
      userId,
      role: role === "person" ? UPLOAD_ROLE.PERSON : UPLOAD_ROLE.GARMENT,
      storageKey,
      contentType,
      sizeBytes,
      precheckPassed: null,
      expiresAt: new Date(now.getTime() + LIMITS.UPLOAD_TTL_MS),
    })
    .returning({ id: uploads.id });

  return jsonOk(
    {
      uploadId: inserted[0].id,
      uploadUrl: "/api/uploads/upload",
      maxBytes: LIMITS.MAX_UPLOAD_BYTES,
    },
    { status: 200 }
  );
});
