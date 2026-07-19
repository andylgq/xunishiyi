import { eq, asc } from "drizzle-orm";
import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { requireAdmin } from "@/app/api/admin/_lib/guard";
import { NotFoundError } from "@/lib/errors";
import { db } from "@/db/drizzle";
import { ensureMigrated } from "@/db/ensure-migrated";
import { tryonTasks, tryonResults, taskLogs, feedback, uploads } from "@/db/schema";
import { signRelativeFileUrl } from "@/server/storage/signed-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TaskDetail {
  task: {
    id: string;
    userId: string;
    personUploadId: string;
    garmentUploadId: string;
    garmentType: string;
    status: string;
    providerName: string;
    providerTaskIds: string[] | null;
    seeds: number[] | null;
    attemptCount: number;
    maxAttempts: number;
    originalTaskId: string | null;
    quotaCharged: boolean;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    createdAt: string;
    submittedAt: string | null;
    lastPolledAt: string | null;
    completedAt: string | null;
    expiresAt: string;
  };
  uploads: {
    person: { id: string; url: string; contentType: string; sizeBytes: number };
    garment: { id: string; url: string; contentType: string; sizeBytes: number };
  };
  results: Array<{
    id: string;
    index: number;
    seed: number | null;
    url: string;
    isSaved: boolean;
    isDeleted: boolean;
    createdAt: string;
  }>;
  logs: Array<{
    id: string;
    event: string;
    payload: unknown;
    createdAt: string;
  }>;
  feedback: {
    id: string;
    helpfulLevel: string;
    reasons: string[] | null;
    comment: string | null;
    createdAt: string;
  } | null;
}

export const GET = apiHandler(async (req, ctx) => {
  await requireAdmin();
  await ensureMigrated();
  const { taskId } = await ctx.params;
  if (!taskId) throw new NotFoundError("任务不存在");

  // Task
  const taskRows = await db
    .select()
    .from(tryonTasks)
    .where(eq(tryonTasks.id, taskId))
    .limit(1);
  const t = taskRows[0];
  if (!t) throw new NotFoundError("任务不存在");

  // Uploads
  const [personUpload, garmentUpload] = await Promise.all([
    db.select().from(uploads).where(eq(uploads.id, t.personUploadId)).limit(1),
    db.select().from(uploads).where(eq(uploads.id, t.garmentUploadId)).limit(1),
  ]);
  const pu = personUpload[0];
  const gu = garmentUpload[0];

  // Results
  const resultRows = await db
    .select()
    .from(tryonResults)
    .where(eq(tryonResults.taskId, taskId))
    .orderBy(asc(tryonResults.index));

  const resultsWithUrl = await Promise.all(
    resultRows.map(async (r) => ({
      id: r.id,
      index: r.index,
      seed: r.seed,
      url: await signRelativeFileUrl(r.id),
      isSaved: r.isSaved,
      isDeleted: r.isDeleted,
      createdAt: r.createdAt.toISOString(),
    }))
  );

  // Logs
  const logRows = await db
    .select()
    .from(taskLogs)
    .where(eq(taskLogs.taskId, taskId))
    .orderBy(asc(taskLogs.createdAt));

  // Feedback
  const feedbackRows = await db
    .select()
    .from(feedback)
    .where(eq(feedback.taskId, taskId))
    .limit(1);

  const response: TaskDetail = {
    task: {
      id: t.id,
      userId: t.userId,
      personUploadId: t.personUploadId,
      garmentUploadId: t.garmentUploadId,
      garmentType: t.garmentType,
      status: t.status,
      providerName: t.providerName,
      providerTaskIds: t.providerTaskIds,
      seeds: t.seeds,
      attemptCount: t.attemptCount,
      maxAttempts: t.maxAttempts,
      originalTaskId: t.originalTaskId,
      quotaCharged: t.quotaCharged,
      lastErrorCode: t.lastErrorCode,
      lastErrorMessage: t.lastErrorMessage,
      createdAt: t.createdAt.toISOString(),
      submittedAt: t.submittedAt?.toISOString() ?? null,
      lastPolledAt: t.lastPolledAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      expiresAt: t.expiresAt.toISOString(),
    },
    uploads: {
      person: pu
        ? {
            id: pu.id,
            url: await signRelativeFileUrl(pu.id),
            contentType: pu.contentType,
            sizeBytes: pu.sizeBytes,
          }
        : {
            id: t.personUploadId,
            url: "",
            contentType: "",
            sizeBytes: 0,
          },
      garment: gu
        ? {
            id: gu.id,
            url: await signRelativeFileUrl(gu.id),
            contentType: gu.contentType,
            sizeBytes: gu.sizeBytes,
          }
        : {
            id: t.garmentUploadId,
            url: "",
            contentType: "",
            sizeBytes: 0,
          },
    },
    results: resultsWithUrl,
    logs: logRows.map((l) => ({
      id: l.id,
      event: l.event,
      payload: l.payload,
      createdAt: l.createdAt.toISOString(),
    })),
    feedback: feedbackRows[0]
      ? {
          id: feedbackRows[0].id,
          helpfulLevel: feedbackRows[0].helpfulLevel,
          reasons: feedbackRows[0].reasons,
          comment: feedbackRows[0].comment,
          createdAt: feedbackRows[0].createdAt.toISOString(),
        }
      : null,
  };

  return jsonOk(response);
});
