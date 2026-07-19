import { db } from "@/db/drizzle";
import { metricsEvents } from "@/db/schema";

export interface MetricEventData {
  userId?: string;
  taskId?: string;
  durationMs?: number;
  props?: Record<string, unknown>;
}

export async function recordEvent(
  eventName: string,
  data: MetricEventData = {}
): Promise<void> {
  try {
    await db.insert(metricsEvents).values({
      eventName,
      userId: data.userId,
      taskId: data.taskId,
      durationMs: data.durationMs,
      props: data.props,
    });
  } catch (e) {
    // 指标采集失败不应影响主流程
    console.error("[metrics] record failed", e);
  }
}

export const MetricEvent = {
  TRYON_CREATED: "tryon_created",
  TRYON_SUCCEEDED: "tryon_succeeded",
  TRYON_FAILED: "tryon_failed",
  TRYON_TIMEOUT: "tryon_timeout",
  TRYON_CANCELLED: "tryon_cancelled",
  PRECHECK_RUN: "precheck_run",
  PRECHECK_PASSED: "precheck_passed",
  RESULT_SAVED: "result_saved",
  FEEDBACK_SUBMITTED: "feedback_submitted",
} as const;
