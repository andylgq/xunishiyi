import { localFsStorage } from "./local-fs-storage";
import { hasR2Config, r2Storage } from "./r2-storage";
import type { StorageProvider } from "./storage-provider";

export const storage: StorageProvider = hasR2Config() ? r2Storage : localFsStorage;
