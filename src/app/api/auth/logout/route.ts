import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { logout } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = apiHandler(async () => {
  await logout();
  return jsonOk({ message: "已退出登录" });
});
