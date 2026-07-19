export interface StorageProvider {
  save(key: string, buf: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
