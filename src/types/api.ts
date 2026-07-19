import { z } from "zod";
import { ACCEPTED_MIME, LIMITS } from "@/lib/constants";

/* ---------- 错误响应 ---------- */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/* ---------- Upload ---------- */
export const initiateUploadSchema = z.object({
  role: z.enum(["person", "garment"]),
  contentType: z.enum(ACCEPTED_MIME),
  sizeBytes: z.number().int().positive().max(LIMITS.MAX_UPLOAD_BYTES),
});
export type InitiateUploadReq = z.infer<typeof initiateUploadSchema>;
export interface InitiateUploadRes {
  uploadId: string;
  uploadUrl: string;
  maxBytes: number;
}

export interface UploadCheckReq {
  uploadId: string;
}
export interface CheckItem {
  name: string;
  passed: boolean;
  reason?: string;
  severity?: "block" | "warn";
}
export interface UploadCheckRes {
  passed: boolean;
  checks: CheckItem[];
  summary: string;
  /** 预检通过后由后端签发的短期预览 URL（GET /api/files/[id]?token=...） */
  previewUrl?: string;
}

/* ---------- TryOn ---------- */
export const createTaskSchema = z.object({
  personUploadId: z.string().uuid(),
  garmentUploadId: z.string().uuid(),
  garmentType: z.enum(["upper", "outer"]),
});
export type CreateTaskReq = z.infer<typeof createTaskSchema>;
export interface CreateTaskRes {
  taskId: string;
}

export interface TaskViewResult {
  id: string;
  index: number;
  seed: number | null;
  url: string;
  isSaved: boolean;
}
export interface TaskView {
  id: string;
  status: string;
  garmentType: "upper" | "outer";
  attemptCount: number;
  originalTaskId: string | null;
  createdAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  personImageUrl: string | null;
  garmentImageUrl: string | null;
  results: TaskViewResult[];
  quotaCharged: boolean;
}

export interface RetryRes {
  taskId: string;
}

/* ---------- Feedback ---------- */
export const feedbackSchema = z.object({
  taskId: z.string().uuid(),
  helpfulLevel: z.enum(["very_helpful", "somewhat_helpful", "not_helpful"]),
  reasons: z
    .array(
      z.enum([
        "not_like_self",
        "garment_mismatch",
        "body_pose_change",
        "unnatural_wearing",
        "background_change",
        "unclear",
        "other",
      ])
    )
    .optional(),
  comment: z.string().max(500).optional(),
});
export type FeedbackReq = z.infer<typeof feedbackSchema>;

/* ---------- Quota ---------- */
export interface QuotaView {
  total: number;
  used: number;
  reserved: number;
  remaining: number;
}

/* ---------- Cron ---------- */
export interface CronStats {
  scanned?: number;
  advanced?: number;
  removed?: number;
}
