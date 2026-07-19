"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, Shirt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  taskId: string;
  canRetry: boolean;
}

export function ResultActions({ taskId, canRetry }: Props) {
  const router = useRouter();

  async function handleRetry() {
    try {
      const res = await fetch(`/api/tryon/${taskId}/retry`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: { message?: string } })?.error?.message ??
            `重试失败 (${res.status})`
        );
      }
      const newId = (data as { taskId: string }).taskId;
      toast.success("已重新生成");
      router.push(`/tryon/${newId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "重试失败");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild size="lg">
        <Link href="/tryon">
          <Shirt className="mr-1.5 h-4 w-4" />
          继续试穿其他衣服
        </Link>
      </Button>
      {canRetry && (
        <Button variant="outline" size="lg" onClick={handleRetry}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          重新生成
        </Button>
      )}
    </div>
  );
}
