import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  const user = await getCurrentUser();
  return jsonOk({
    userId: user.userId,
    email: user.email,
    isAnonymous: user.isAnonymous,
  });
});
