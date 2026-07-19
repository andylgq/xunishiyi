import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anonUid: text("anon_uid").notNull().unique(),
    isAnonymous: boolean("is_anonymous").default(true).notNull(),
    email: text("email").unique(),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    anonUidIdx: index().on(t.anonUid),
    emailIdx: index().on(t.email),
  })
);
