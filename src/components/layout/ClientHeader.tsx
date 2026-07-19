"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuotaBadge } from "@/components/tryon/QuotaBadge";
import type { CurrentUser } from "@/lib/auth";

interface ClientHeaderProps {
  user: CurrentUser;
}

export function ClientHeader({ user }: ClientHeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        toast.success("已退出登录");
        router.push("/");
      }
    } catch {
      toast.error("退出登录失败");
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-1.5 font-semibold">
          <span className="inline-block h-6 w-6 rounded-md bg-primary" />
          虚拟试衣
        </Link>
        <div className="flex items-center gap-4">
          <QuotaBadge />
          {!user.isAnonymous ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{user.email}</span>
              <Button size="sm" variant="ghost" onClick={handleLogout}>
                退出登录
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button size="sm" variant="ghost">
                  登录
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">注册</Button>
              </Link>
            </div>
          )}
          <Link
            href="/privacy"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            隐私说明
          </Link>
        </div>
      </div>
    </header>
  );
}
