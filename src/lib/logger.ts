/* eslint-disable no-console */
export const logger = {
  info: (...a: unknown[]) => console.log("[info]", ...a),
  warn: (...a: unknown[]) => console.warn("[warn]", ...a),
  error: (...a: unknown[]) => console.error("[error]", ...a),
  debug: (...a: unknown[]) => {
    if (process.env.NODE_ENV !== "production") console.debug("[debug]", ...a);
  },
};

export function logTaskEvent(
  taskId: string,
  event: string,
  payload?: unknown
) {
  logger.info(`[task:${taskId}] ${event}`, payload ?? "");
}
