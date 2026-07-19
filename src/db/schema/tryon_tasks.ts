import { pgTable, uuid, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { uploads } from "./uploads";

export const TASK_STATUS = {
  PENDING: "pending",
  SUBMITTED: "submitted",
  PROCESSING: "processing",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  TIMEOUT: "timeout",
  CANCELLED: "cancelled",
} as const;
export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const GARMENT_TYPE = {
  UPPER: "upper",
  OUTER: "outer",
} as const;
export type GarmentType = (typeof GARMENT_TYPE)[keyof typeof GARMENT_TYPE];

/** 终态：不再轮询 */
export const TERMINAL_STATUSES: TaskStatus[] = [
  TASK_STATUS.SUCCEEDED,
  TASK_STATUS.FAILED,
  TASK_STATUS.TIMEOUT,
  TASK_STATUS.CANCELLED,
];

export const tryonTasks = pgTable(
  "tryon_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    personUploadId: uuid("person_upload_id")
      .notNull()
      .references(() => uploads.id),
    garmentUploadId: uuid("garment_upload_id")
      .notNull()
      .references(() => uploads.id),
    garmentType: text("garment_type").notNull(),
    requestedCount: integer("requested_count").default(3).notNull(),
    status: text("status").notNull().default("pending"),
    providerName: text("provider_name").notNull().default("mock"),
    providerReqKey: text("provider_req_key"),
    providerTaskIds: text("provider_task_ids").array(),
    seeds: integer("seeds").array(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(1).notNull(),
    originalTaskId: uuid("original_task_id"),
    quotaCharged: boolean("quota_charged").default(false).notNull(),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index().on(t.status),
    userIdx: index().on(t.userId),
    pollIdx: index().on(t.status, t.lastPolledAt),
    expiresIdx: index().on(t.expiresAt),
  })
);
