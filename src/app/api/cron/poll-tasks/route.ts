import { env } from "@/lib/env";
import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { pollAllInFlight } from "@/server/tryon/poll-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req) => {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== env.CRON_SECRET) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "cron 鉴权失败" } },
      { status: 401 }
    );
  }
  const stats = await pollAllInFlight();
  return jsonOk(stats);
});
