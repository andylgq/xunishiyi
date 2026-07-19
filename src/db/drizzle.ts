import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  drizzle as drizzlePglite,
} from "drizzle-orm/pglite";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import os from "node:os";
import path from "node:path";
import * as schema from "./schema";

/**
 * 统一对外类型：以 postgres-js 的 API surface 为准。
 * PGlite 与 postgres-js 的查询构建器运行时 API 一致，但 TS 类型不同，
 * 若取并集会导致链式调用（.returning/.onConflictDoNothing 等）报错。
 * 因此统一声明为 PostgresJsDatabase，构造时按 DATABASE_URL 选择真实驱动。
 */
export type Db = PostgresJsDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __tryonDb: Db | undefined;
  // eslint-disable-next-line no-var
  var __tryonPglite: PGlite | undefined;
}

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { max: 5, prepare: false });
    return drizzle(client, { schema });
  }
  // 嵌入式 PGlite：本地零安装开发库
  const dataDir = process.env.VERCEL
    ? path.join(os.tmpdir(), "xunishiyi-pglite-data")
    : "./.pglite-data";
  const pglite = new PGlite({ dataDir });
  global.__tryonPglite = pglite;
  return drizzlePglite(pglite, { schema }) as unknown as Db;
}

export const db: Db = global.__tryonDb ?? createDb();
if (process.env.NODE_ENV !== "production") {
  global.__tryonDb = db;
}

export const isPglite = !process.env.DATABASE_URL;
