import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { getCurrentUserId } from "@/lib/anon-auth";
import { getQuota } from "@/server/quota/quota-service";
import { NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const { userId } = await getCurrentUserId();
  const q = await getQuota(userId);
  if (!q) throw new NotFoundError("额度信息不存在");
  return jsonOk(q);
});
