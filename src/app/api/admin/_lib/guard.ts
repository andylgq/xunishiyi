/**
 * Admin API 路由守卫。
 *
 * 所有 /api/admin/* 路由首行调用：
 *   await requireAdmin();
 * 失败抛 AppError(401)，由 apiHandler 统一转 401 响应。
 *
 * 此文件只是 re-export，方便 import 路径稳定。
 */
export { requireAdmin } from "@/lib/admin-auth";
