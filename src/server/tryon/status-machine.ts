import { TASK_STATUS } from "@/db/schema";

/** DB 中 status 列为 text，统一以 string 入参，避免到处 cast。 */
export function canCancel(s: string): boolean {
  return (
    s === TASK_STATUS.PENDING ||
    s === TASK_STATUS.SUBMITTED ||
    s === TASK_STATUS.PROCESSING
  );
}

/** 手动重试：仅失败/超时可重试（成功后重试视为新任务，由上层 createTask 处理） */
export function canManualRetry(s: string): boolean {
  return s === TASK_STATUS.FAILED || s === TASK_STATUS.TIMEOUT;
}

export function isTerminal(s: string): boolean {
  return (
    s === TASK_STATUS.SUCCEEDED ||
    s === TASK_STATUS.FAILED ||
    s === TASK_STATUS.TIMEOUT ||
    s === TASK_STATUS.CANCELLED
  );
}

export function canAutoRetry(attemptCount: number, maxAttempts: number): boolean {
  return attemptCount < maxAttempts;
}
