import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CancelTaskButton } from "./CancelTaskButton";
import { db } from "@/db/drizzle";
import { ensureMigrated } from "@/db/ensure-migrated";
import { eq, asc } from "drizzle-orm";
import {
  tryonTasks,
  tryonResults,
  taskLogs,
  feedback,
  uploads,
} from "@/db/schema";
import { signRelativeFileUrl } from "@/server/storage/signed-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  submitted: "已提交",
  processing: "处理中",
  succeeded: "成功",
  failed: "失败",
  timeout: "超时",
  cancelled: "已取消",
};

const FEEDBACK_LABELS: Record<string, string> = {
  very_helpful: "很有帮助",
  somewhat_helpful: "有一定帮助",
  not_helpful: "没有帮助",
};

const REASON_LABELS: Record<string, string> = {
  not_like_self: "不像本人",
  garment_mismatch: "衣服不像原图",
  body_pose_change: "身材/姿势变化",
  unnatural_wearing: "穿着不自然",
  background_change: "背景变化",
  unclear: "图片不清晰",
  other: "其他",
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN");
}

function formatDuration(from: string | null, to: string | null): string {
  if (!from || !to) return "—";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  await ensureMigrated();
  const { taskId } = await params;

  const taskRows = await db
    .select()
    .from(tryonTasks)
    .where(eq(tryonTasks.id, taskId))
    .limit(1);
  const t = taskRows[0];
  if (!t) notFound();

  const [personUpload, garmentUpload] = await Promise.all([
    db.select().from(uploads).where(eq(uploads.id, t.personUploadId)).limit(1),
    db.select().from(uploads).where(eq(uploads.id, t.garmentUploadId)).limit(1),
  ]);
  const pu = personUpload[0];
  const gu = garmentUpload[0];

  const resultRows = await db
    .select()
    .from(tryonResults)
    .where(eq(tryonResults.taskId, taskId))
    .orderBy(asc(tryonResults.index));

  const resultsWithUrl = await Promise.all(
    resultRows.map(async (r) => ({
      ...r,
      url: await signRelativeFileUrl(r.id),
    }))
  );

  const logRows = await db
    .select()
    .from(taskLogs)
    .where(eq(taskLogs.taskId, taskId))
    .orderBy(asc(taskLogs.createdAt));

  const feedbackRows = await db
    .select()
    .from(feedback)
    .where(eq(feedback.taskId, taskId))
    .limit(1);
  const fb = feedbackRows[0];

  const personUrl = pu ? await signRelativeFileUrl(pu.id) : "";
  const garmentUrl = gu ? await signRelativeFileUrl(gu.id) : "";

  const canCancel =
    t.status === "submitted" || t.status === "processing";

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin/tasks"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 返回任务列表
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">任务详情</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{t.id}</p>
        </div>
        {canCancel && <CancelTaskButton taskId={t.id} />}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: Task info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="状态" value={
              <span className="font-medium">{STATUS_LABELS[t.status] ?? t.status}</span>
            } />
            <Row label="服装类型" value={t.garmentType === "upper" ? "上衣" : "外套"} />
            <Row label="Provider" value={t.providerName} />
            <Row label="尝试次数" value={`${t.attemptCount} / ${t.maxAttempts}`} />
            <Row label="额度已扣" value={t.quotaCharged ? "是" : "否"} />
            {t.originalTaskId && (
              <Row label="原任务" value={
                <Link href={`/admin/tasks/${t.originalTaskId}`} className="text-primary hover:underline">
                  {t.originalTaskId.slice(0, 8)}…
                </Link>
              } />
            )}
            <Row label="用户 ID" value={
              <Link href={`/admin/users?userId=${t.userId}`} className="font-mono text-xs text-primary hover:underline">
                {t.userId.slice(0, 12)}…
              </Link>
            } />
            <Row label="创建时间" value={formatTime(t.createdAt.toISOString())} />
            <Row label="提交时间" value={formatTime(t.submittedAt?.toISOString() ?? null)} />
            <Row label="完成时间" value={formatTime(t.completedAt?.toISOString() ?? null)} />
            <Row label="耗时" value={formatDuration(
              t.submittedAt?.toISOString() ?? null,
              t.completedAt?.toISOString() ?? null
            )} />
            <Row label="过期时间" value={formatTime(t.expiresAt.toISOString())} />
            {t.lastErrorCode && (
              <Row label="错误码" value={<span className="text-destructive">{t.lastErrorCode}</span>} />
            )}
            {t.lastErrorMessage && (
              <div className="pt-2">
                <div className="text-muted-foreground">错误详情</div>
                <div className="mt-1 rounded bg-destructive/10 p-2 text-xs text-destructive">
                  {t.lastErrorMessage}
                </div>
              </div>
            )}
            {t.providerTaskIds && t.providerTaskIds.length > 0 && (
              <div className="pt-2">
                <div className="text-muted-foreground">Provider Task IDs</div>
                <div className="mt-1 space-y-1 font-mono text-xs">
                  {t.providerTaskIds.map((id, i) => (
                    <div key={i}>{id}</div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Inputs + Results */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>输入图片</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    人物图 {pu && `(${pu.width}×${pu.height}, ${(pu.sizeBytes / 1024).toFixed(0)}KB)`}
                  </div>
                  {personUrl ? (
                    <img
                      src={personUrl}
                      alt="人物图"
                      className="aspect-[3/4] w-full rounded-md border object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center rounded-md border text-muted-foreground">
                      已删除
                    </div>
                  )}
                </div>
                <div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    服装图 {gu && `(${gu.width}×${gu.height}, ${(gu.sizeBytes / 1024).toFixed(0)}KB)`}
                  </div>
                  {garmentUrl ? (
                    <img
                      src={garmentUrl}
                      alt="服装图"
                      className="aspect-[3/4] w-full rounded-md border object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center rounded-md border text-muted-foreground">
                      已删除
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                结果图 ({resultsWithUrl.filter((r) => !r.isDeleted).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resultsWithUrl.length === 0 ? (
                <p className="text-sm text-muted-foreground">无结果图</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {resultsWithUrl.map((r) => (
                    <div key={r.id} className="relative">
                      <img
                        src={r.url}
                        alt={`结果 ${r.index}`}
                        className={`aspect-[3/4] w-full rounded-md border object-cover ${
                          r.isDeleted ? "opacity-30" : ""
                        }`}
                      />
                      <div className="mt-1 text-xs text-muted-foreground">
                        #{r.index}
                        {r.seed != null && ` · seed=${r.seed}`}
                        {r.isSaved && <span className="ml-1 text-emerald-600">已保存</span>}
                        {r.isDeleted && <span className="ml-1 text-destructive">已删除</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Logs timeline */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>任务日志 ({logRows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {logRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">无日志</p>
          ) : (
            <ol className="space-y-2 border-l-2 border-muted pl-4">
              {logRows.map((l) => (
                <li key={l.id} className="relative">
                  <span className="absolute -left-[1.4rem] top-1 inline-block h-2 w-2 rounded-full bg-primary" />
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(l.createdAt).toLocaleTimeString("zh-CN")}
                    </span>
                    <span className="text-sm font-medium">{l.event}</span>
                  </div>
                  {l.payload != null && (
                    <pre className="mt-1 overflow-x-auto rounded bg-muted/40 p-2 text-xs">
                      {JSON.stringify(l.payload, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Feedback */}
      {fb && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>用户反馈</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="帮助程度"
              value={FEEDBACK_LABELS[fb.helpfulLevel] ?? fb.helpfulLevel}
            />
            {fb.reasons && fb.reasons.length > 0 && (
              <Row
                label="原因"
                value={fb.reasons.map((r) => REASON_LABELS[r] ?? r).join("、")}
              />
            )}
            {fb.comment && <Row label="评论" value={fb.comment} />}
            <Row
              label="提交时间"
              value={formatTime(fb.createdAt.toISOString())}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-24 shrink-0 text-muted-foreground">{label}</div>
      <div className="flex-1">{value}</div>
    </div>
  );
}
