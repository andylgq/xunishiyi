/** 客户端枚举镜像（与 src/db/schema 常量字符串值保持一致） */

export type TaskStatusUnion =
  | "pending"
  | "submitted"
  | "processing"
  | "succeeded"
  | "failed"
  | "timeout"
  | "cancelled";

export type GarmentTypeUnion = "upper" | "outer";

export type HelpfulLevelUnion =
  | "very_helpful"
  | "somewhat_helpful"
  | "not_helpful";

export type FeedbackReasonUnion =
  | "not_like_self"
  | "garment_mismatch"
  | "body_pose_change"
  | "unnatural_wearing"
  | "background_change"
  | "unclear"
  | "other";

export const TERMINAL_STATUSES_CLIENT: TaskStatusUnion[] = [
  "succeeded",
  "failed",
  "timeout",
  "cancelled",
];

export function isTerminalStatus(s: string): boolean {
  return (TERMINAL_STATUSES_CLIENT as string[]).includes(s);
}

export const TASK_STATUS_LABEL: Record<TaskStatusUnion, string> = {
  pending: "准备中",
  submitted: "已提交",
  processing: "生成中",
  succeeded: "已完成",
  failed: "失败",
  timeout: "超时",
  cancelled: "已取消",
};

export const GARMENT_TYPE_LABEL: Record<GarmentTypeUnion, string> = {
  upper: "上衣",
  outer: "外套",
};

export const HELPFUL_LEVEL_LABEL: Record<HelpfulLevelUnion, string> = {
  very_helpful: "很有帮助",
  somewhat_helpful: "有一定帮助",
  not_helpful: "没有帮助",
};

export const FEEDBACK_REASON_LABEL: Record<FeedbackReasonUnion, string> = {
  not_like_self: "不像本人",
  garment_mismatch: "衣服不像原图",
  body_pose_change: "身材或姿势变化",
  unnatural_wearing: "穿着不自然",
  background_change: "背景变化",
  unclear: "图片不清晰",
  other: "其他",
};
