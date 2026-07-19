import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * 鉴权 layout：仅保护 (authed) 路由组下的页面。
 * /admin/login 在此路由组之外，不会触发鉴权（避免循环重定向）。
 */
export default async function AuthedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    redirect("/admin/login");
  }
  return <AdminShell>{children}</AdminShell>;
}
