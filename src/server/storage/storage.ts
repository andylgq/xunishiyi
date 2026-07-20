import { localFsStorage } from "./local-fs-storage";
import { hasR2Config, r2Storage } from "./r2-storage";
import type { StorageProvider } from "./storage-provider";
import { logger } from "@/lib/logger";

let storageImpl: StorageProvider | null = null;

function getStorage(): StorageProvider {
  if (storageImpl) return storageImpl;

  if (hasR2Config()) {
    try {
      storageImpl = r2Storage;
      logger.info("[storage] Using R2 storage");
    } catch (e) {
      logger.error("[storage] R2 init failed, falling back to local", e);
      storageImpl = localFsStorage;
    }
  } else {
    storageImpl = localFsStorage;
    logger.info("[storage] Using local filesystem storage");
  }

  return storageImpl;
}

export const storage: StorageProvider = {
  async save(key, buf, contentType) {
    const impl = getStorage();
    try {
      await impl.save(key, buf, contentType);
    } catch (e) {
      if (impl !== localFsStorage) {
        logger.error("[storage] R2 save failed, falling back to local", e);
        await localFsStorage.save(key, buf, contentType);
      } else {
        throw e;
      }
    }
  },

  async read(key) {
    const impl = getStorage();
    try {
      const result = await impl.read(key);
      if (result === null && impl !== localFsStorage) {
        logger.warn("[storage] R2 read returned null, trying local");
        return await localFsStorage.read(key);
      }
      return result;
    } catch (e) {
      if (impl !== localFsStorage) {
        logger.error("[storage] R2 read failed, falling back to local", e);
        return await localFsStorage.read(key);
      } else {
        throw e;
      }
    }
  },

  async remove(key) {
    const impl = getStorage();
    try {
      await impl.remove(key);
    } catch (e) {
      if (impl !== localFsStorage) {
        logger.error("[storage] R2 remove failed, trying local", e);
        await localFsStorage.remove(key);
      } else {
        throw e;
      }
    }
  },

  async exists(key) {
    const impl = getStorage();
    try {
      const result = await impl.exists(key);
      if (!result && impl !== localFsStorage) {
        logger.warn("[storage] R2 exists returned false, trying local");
        return await localFsStorage.exists(key);
      }
      return result;
    } catch (e) {
      if (impl !== localFsStorage) {
        logger.error("[storage] R2 exists failed, falling back to local", e);
        return await localFsStorage.exists(key);
      } else {
        throw e;
      }
    }
  },
};
