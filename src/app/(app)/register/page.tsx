"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("请填写邮箱和密码");
      return;
    }
    if (!email.includes("@")) {
      toast.error("请输入有效的邮箱地址");
      return;
    }
    if (password.length < 6) {
      toast.error("密码至少需要 6 个字符");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("两次输入的密码不一致");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: { message?: string } })?.error?.message ?? "注册失败");
      }
      toast.success("注册成功，正在跳转到首页…");
      router.push("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "注册失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">注册账户</h1>
          <p className="mt-1 text-sm text-muted-foreground">创建账户以使用虚拟试衣功能</p>
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
              placeholder="请输入密码（至少6个字符）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Spinner className="mr-1.5 h-4 w-4" /> 注册中…
              </>
            ) : (
              "注册"
            )}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          已有账户？{" "}
          <button
            onClick={() => router.push("/login")}
            className="text-primary underline-offset-4 hover:underline"
          >
            立即登录
          </button>
        </div>
      </div>
    </div>
  );
}
