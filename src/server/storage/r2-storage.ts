import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { StorageProvider } from "./storage-provider";

interface R2Config {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

let client: S3Client | null = null;

function getR2Config(): R2Config {
  const bucket = process.env.R2_BUCKET_NAME;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 storage is not fully configured");
  }

  return { bucket, endpoint, accessKeyId, secretAccessKey };
}

export function hasR2Config(): boolean {
  return Boolean(
    process.env.R2_BUCKET_NAME &&
      process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
  );
}

function getClient(): S3Client {
  if (client) return client;

  const config = getR2Config();
  client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return client;
}

function safeKey(key: string): string {
  return key.replace(/\.\./g, "").replace(/^\/+/, "");
}

async function bodyToBuffer(body: unknown): Promise<Buffer | null> {
  if (!body) return null;

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  ) {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export const r2Storage: StorageProvider = {
  async save(key, buf, contentType) {
    const config = getR2Config();
    await getClient().send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: safeKey(key),
        Body: buf,
        ContentType: contentType,
      })
    );
  },

  async read(key) {
    const config = getR2Config();
    try {
      const result = await getClient().send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: safeKey(key),
        })
      );
      return bodyToBuffer(result.Body);
    } catch {
      return null;
    }
  },

  async remove(key) {
    const config = getR2Config();
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: safeKey(key),
      })
    );
  },

  async exists(key) {
    const config = getR2Config();
    try {
      await getClient().send(
        new HeadObjectCommand({
          Bucket: config.bucket,
          Key: safeKey(key),
        })
      );
      return true;
    } catch {
      return false;
    }
  },
};
