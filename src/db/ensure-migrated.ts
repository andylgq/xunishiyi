import path from "node:path";
import { db, isPglite } from "./drizzle";

let migratePromise: Promise<void> | null = null;

/**
 * 在应用首次访问数据库前运行 Drizzle 迁移。
 * 使用全局 Promise 缓存，保证整个进程只跑一次。
 * 失败时清空缓存以便下次重试。
 */
export function ensureMigrated(): Promise<void> {
  if (!migratePromise) {
    migratePromise = doMigrate().catch((err) => {
      migratePromise = null;
      throw err;
    });
  }
  return migratePromise;
}

async function doMigrate(): Promise<void> {
  const migrationsFolder = path.join(process.cwd(), "src", "db", "migrations");
  if (isPglite) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as unknown as Parameters<typeof migrate>[0], {
      migrationsFolder,
    });
  } else {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder });
  }
}
