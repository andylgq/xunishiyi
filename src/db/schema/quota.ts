import { pgTable, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const quota = pgTable("quota", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  totalQuota: integer("total_quota").notNull().default(5),
  usedQuota: integer("used_quota").notNull().default(0),
  reservedQuota: integer("reserved_quota").notNull().default(0),
  periodStartAt: timestamp("period_start_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
