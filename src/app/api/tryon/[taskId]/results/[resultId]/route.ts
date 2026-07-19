import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { getCurrentUserId } from "@/lib/anon-auth";
import { deleteResult } from "@/server/tryon/task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = apiHandler(async (req, ctx) => {
  const { userId } = await getCurrentUserId();
  const { taskId, resultId } = await ctx.params;
  await deleteResult(userId, taskId, resultId);
  return jsonOk({ ok: true });
});
