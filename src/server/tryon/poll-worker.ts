import { and, inArray, lt, asc } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { ensureMigrated } from "@/db/ensure-migrated";
import { tryonTasks, TASK_STATUS } from "@/db/schema";
import { logger } from "@/lib/logger";
import { pollAndAdvance } from "./task-service";

const POLL_BATCH_LIMIT = 50;
const POLL_STALE_MS = 20_000; // 距上次轮询超过 20s 才兜底推进

export interface PollStats {
  scanned: number;
  advanced: number;
}

/**
 * 批量扫描在途任务并推进。
 * 串行处理每个任务以避免同一任务被并发推进造成结果重复落库。
 * 供 /api/cron/poll-tasks 调用，作为用户关页后的离线兜底。
 */
export async function pollAllInFlight(): Promise<PollStats> {
  await ensureMigrated();
  const cutoff = new Date(Date.now() - POLL_STALE_MS);
  const rows = await db
    .select()
    .from(tryonTasks)
    .where(
      and(
        inArray(tryonTasks.status, [TASK_STATUS.SUBMITTED, TASK_STATUS.PROCESSING]),
        lt(tryonTasks.lastPolledAt, cutoff)
      )
    )
    .orderBy(asc(tryonTasks.lastPolledAt))
    .limit(POLL_BATCH_LIMIT);

  let advanced = 0;
  for (const task of rows) {
    try {
      await pollAndAdvance(task);
      advanced++;
    } catch (e) {
      logger.error(`[poll-worker] task ${task.id} advance failed`, e);
    }
  }
  return { scanned: rows.length, advanced };
}
