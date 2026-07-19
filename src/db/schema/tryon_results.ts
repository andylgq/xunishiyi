import { pgTable, uuid, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { tryonTasks } from "./tryon_tasks";

export const tryonResults = pgTable(
  "tryon_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tryonTasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    index: integer("index").notNull(),
    seed: integer("seed"),
    storageKey: text("storage_key"),
    isSaved: boolean("is_saved").default(false).notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    taskIdx: index().on(t.taskId),
    expiresIdx: index().on(t.expiresAt),
  })
);
