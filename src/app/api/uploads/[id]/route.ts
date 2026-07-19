import { and, eq } from "drizzle-orm";
import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { getCurrentUserId } from "@/lib/anon-auth";
import { ensureMigrated } from "@/db/ensure-migrated";
import { db } from "@/db/drizzle";
import { uploads } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import { localFsStorage } from "@/server/storage/local-fs-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = apiHandler(async (req, ctx) => {
  await ensureMigrated();
  const { userId } = await getCurrentUserId();
  const { id } = await ctx.params;
  const rows = await db
    .select()
    .from(uploads)
    .where(and(eq(uploads.id, id), eq(uploads.userId, userId)))
    .limit(1);
  const upload = rows[0];
  if (!upload) throw new NotFoundError("上传记录不存在");

  await db.update(uploads).set({ isDeleted: true }).where(eq(uploads.id, id));
  try {
    await localFsStorage.remove(upload.storageKey);
  } catch {
    /* ignore */
  }
  return jsonOk({ ok: true });
});
