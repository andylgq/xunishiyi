import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { getCurrentUserId } from "@/lib/anon-auth";
import { retryTask } from "@/server/tryon/task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req, ctx) => {
  const { userId } = await getCurrentUserId();
  const { taskId } = await ctx.params;
  const { taskId: newTaskId } = await retryTask(userId, taskId);
  return jsonOk({ taskId: newTaskId });
});
