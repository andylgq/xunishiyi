import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { clearAdminSessionCookie } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async () => {
  await clearAdminSessionCookie();
  return jsonOk({ ok: true });
});
