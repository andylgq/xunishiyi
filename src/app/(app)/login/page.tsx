"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("请填写邮箱和密码");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: { message?: string } })?.error?.message ?? "登录失败");
      }
      toast.success("登录成功，正在跳转到首页…");
      router.push("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">登录账户</h1>
          <p className="mt-1 text-sm text-muted-foreground">登录以使用虚拟试衣功能</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="请输入邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Spinner className="mr-1.5 h-4 w-4" /> 登录中…
              </>
            ) : (
              "登录"
            )}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          还没有账户？{" "}
          <button
            onClick={() => router.push("/register")}
            className="text-primary underline-offset-4 hover:underline"
          >
            立即注册
          </button>
        </div>
      </div>
    </div>
  );
}
