import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const UPLOAD_ROLE = {
  PERSON: "person",
  GARMENT: "garment",
} as const;
export type UploadRole = (typeof UPLOAD_ROLE)[keyof typeof UPLOAD_ROLE];

export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    sha256: text("sha256"),
    precheckPassed: boolean("precheck_passed"),
    precheckResult: jsonb("precheck_result"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index().on(t.userId),
    expiresIdx: index().on(t.expiresAt),
  })
);
