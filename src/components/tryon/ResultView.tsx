"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useTaskPolling } from "@/hooks/useTaskPolling";
import { TaskStatusBadge } from "@/components/tryon/TaskStatusBadge";
import { ResultGrid } from "@/components/tryon/ResultGrid";
import { ResultActions } from "@/components/tryon/ResultActions";
import { FeedbackForm } from "@/components/tryon/FeedbackForm";
import { PrivacyBanner } from "@/components/privacy/PrivacyBanner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { isTerminalStatus } from "@/types/tryon";

interface Props {
  taskId: string;
}

export function ResultView({ taskId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: task, isLoading, error } = useTaskPolling(taskId);

  async function handleDeleteResult(resultId: string) {
    try {
      const res = await fetch(`/api/tryon/${taskId}/results/${resultId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          (d as { error?: { message?: string } })?.error?.message ?? "删除失败"
        );
      }
      // 本地更新缓存
      qc.setQueryData(["task", taskId], (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const o = old as { results?: { id: string }[] };
        return {
          ...o,
          results: (o.results ?? []).filter((r) => r.id !== resultId),
        };
      });
      toast.success("已删除");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  }

  async function handleCancel() {
    try {
      const res = await fetch(`/api/tryon/${taskId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          (d as { error?: { message?: string } })?.error?.message ?? "取消失败"
        );
      }
      toast.success("已取消");
      qc.invalidateQueries({ queryKey: ["task", taskId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "取消失败");
    }
  }

  if (isLoading || !task) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error.message}</p>
        <Button className="mt-4" variant="outline" onClick={() => router.push("/tryon")}>
          返回重新上传
        </Button>
      </div>
    );
  }

  const terminal = isTerminalStatus(task.status);
  const inFlight = !terminal && task.status !== "failed" && task.status !== "timeout" && task.status !== "cancelled";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">试衣结果</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {task.submittedAt && `提交于 ${new Date(task.submittedAt).toLocaleString()}`}
          </p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      {/* 参考图 */}
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">本人照片</p>
          {task.personImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={task.personImageUrl}
              alt="本人照片"
              className="aspect-[3/4] w-full rounded-md border object-contain bg-muted/20"
            />
          ) : null}
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">服装图片</p>
          {task.garmentImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={task.garmentImageUrl}
              alt="服装图片"
              className="aspect-[3/4] w-full rounded-md border object-contain bg-muted/20"
            />
          ) : null}
        </div>
      </div>

      {/* 进行中 */}
      {inFlight && (
        <div className="rounded-lg border bg-card p-8 text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="font-medium">正在生成试衣效果图…</p>
          <p className="mt-1 text-xs text-muted-foreground">
            通常约 30 秒，请稍候。生成完成后会自动展示。
          </p>
          <div className="mx-auto mt-4 max-w-xs">
            <Progress value={50} className="animate-pulse" />
          </div>
          <Button variant="outline" className="mt-4" onClick={handleCancel}>
            取消任务
          </Button>
        </div>
      )}

      {/* 成功 */}
      {task.status === "succeeded" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            已生成 {task.results.length} 张效果图
          </div>
          {task.results.length > 0 ? (
            <ResultGrid results={task.results} onDeleted={handleDeleteResult} />
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              结果已被全部删除
            </div>
          )}
          <ResultActions taskId={taskId} canRetry={task.results.length === 0} />
          <PrivacyBanner />
          <FeedbackForm taskId={taskId} />
        </div>
      )}

      {/* 失败/超时 */}
      {(task.status === "failed" || task.status === "timeout") && (
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">
                {task.status === "timeout" ? "任务超时" : "生成失败"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {task.lastErrorMessage ?? "请稍后重试"}
            </p>
          </div>
          <ResultActions taskId={taskId} canRetry />
        </div>
      )}

      {/* 已取消 */}
      {task.status === "cancelled" && (
        <div className="rounded-lg border bg-card p-8 text-center">
          <XCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">任务已取消</p>
          <Button className="mt-4" asChild>
            <a href="/tryon">重新开始</a>
          </Button>
        </div>
      )}
    </div>
  );
}
