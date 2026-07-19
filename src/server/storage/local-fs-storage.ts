import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageProvider } from "./storage-provider";

const ROOT = path.join(process.cwd(), "uploads");

function full(key: string): string {
  // 防止路径穿越
  const safe = key.replace(/\.\./g, "").replace(/^\/+/, "");
  return path.join(ROOT, safe);
}

async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export const localFsStorage: StorageProvider = {
  async save(key, buf) {
    const p = full(key);
    await ensureDir(p);
    await fs.writeFile(p, buf);
  },
  async read(key) {
    try {
      return await fs.readFile(full(key));
    } catch {
      return null;
    }
  },
  async remove(key) {
    try {
      await fs.rm(full(key), { force: true });
    } catch {
      /* ignore */
    }
  },
  async exists(key) {
    try {
      await fs.access(full(key));
      return true;
    } catch {
      return false;
    }
  },
};
