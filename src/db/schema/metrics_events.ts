import { pgTable, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const metricsEvents = pgTable(
  "metrics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventName: text("event_name").notNull(),
    userId: uuid("user_id"),
    taskId: uuid("task_id"),
    durationMs: integer("duration_ms"),
    props: jsonb("props"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameTimeIdx: index().on(t.eventName, t.createdAt),
  })
);
