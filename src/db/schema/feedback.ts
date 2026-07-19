import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tryonTasks } from "./tryon_tasks";

export const HELPFUL_LEVEL = {
  VERY_HELPFUL: "very_helpful",
  SOMEWHAT_HELPFUL: "somewhat_helpful",
  NOT_HELPFUL: "not_helpful",
} as const;
export type HelpfulLevel = (typeof HELPFUL_LEVEL)[keyof typeof HELPFUL_LEVEL];

export const FEEDBACK_REASONS = [
  "not_like_self",
  "garment_mismatch",
  "body_pose_change",
  "unnatural_wearing",
  "background_change",
  "unclear",
  "other",
] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tryonTasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    helpfulLevel: text("helpful_level").notNull(),
    reasons: text("reasons").array(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    taskUniqueIdx: uniqueIndex("feedback_task_id_uniq").on(t.taskId),
  })
);
