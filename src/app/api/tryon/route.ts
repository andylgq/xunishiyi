import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { getCurrentUserId } from "@/lib/anon-auth";
import { createTaskSchema } from "@/types/api";
import { ValidationError } from "@/lib/errors";
import { createTask } from "@/server/tryon/task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = apiHandler(async (req) => {
  const { userId } = await getCurrentUserId();
  const body = await req.json().catch(() => ({}));
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("参数错误", parsed.error.flatten());
  }
  const { taskId } = await createTask({
    userId,
    personUploadId: parsed.data.personUploadId,
    garmentUploadId: parsed.data.garmentUploadId,
    garmentType: parsed.data.garmentType,
  });
  return jsonOk({ taskId }, { status: 201 });
});
