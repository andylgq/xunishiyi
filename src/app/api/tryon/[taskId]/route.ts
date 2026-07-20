import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { getCurrentUserId } from "@/lib/anon-auth";
import { getTaskWithResults, cancelTask } from "@/server/tryon/task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = apiHandler(async (req, ctx) => {
  const { userId } = await getCurrentUserId();
  const { taskId } = await ctx.params;
  const view = await getTaskWithResults(userId, taskId);
  return jsonOk(view);
});

export const DELETE = apiHandler(async (req, ctx) => {
  const { userId } = await getCurrentUserId();
  const { taskId } = await ctx.params;
  await cancelTask(userId, taskId);
  return jsonOk({ ok: true });
});
