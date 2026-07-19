import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { requireAdmin } from "@/app/api/admin/_lib/guard";
import {
  cleanupExpiredUploads,
  cleanupExpiredResults,
} from "@/server/tryon/task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async () => {
  await requireAdmin();

  const [removedUploads, removedResults] = await Promise.all([
    cleanupExpiredUploads(),
    cleanupExpiredResults(),
  ]);

  return jsonOk({
    ok: true,
    removedUploads,
    removedResults,
    total: removedUploads + removedResults,
  });
});
