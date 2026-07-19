import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import type {
  TryOnProvider,
  SubmitParams,
  SubmitResult,
  StatusResult,
  ResultImage,
} from "./provider";
import { ProviderError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { db } from "@/db/drizzle";
import { uploads, tryonResults } from "@/db/schema";
import { ensureMigrated } from "@/db/ensure-migrated";
import { localFsStorage } from "@/server/storage/local-fs-storage";

const ARK_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const ARK_MODEL = "doubao-seedream-5-0-260128";

interface ArkApiResponse {
  model: string;
  created: number;
  data: Array<{ url: string; size: string }>;
  usage?: {
    generated_images: number;
    output_tokens: number;
    total_tokens: number;
  };
}

interface ArkResult {
  url: string;
}

type ArkPromise = Promise<ArkResult>;

export class ArkTryOnProvider implements TryOnProvider {
  readonly name = "ark";

  private tasks = new Map<string, ArkPromise>();

  constructor(private apiKey: string) {}

  submitTask(params: SubmitParams): Promise<SubmitResult> {
    const taskId = `${Date.now()}-${nanoid(8)}`;

    const promise = this.callArkApi(params);

    this.tasks.set(taskId, promise);

    promise.catch((e) => {
      logger.error(`[ark:${taskId}] API call failed`, e);
    });

    return Promise.resolve({
      providerTaskId: taskId,
      raw: { seed: params.seed, garmentType: params.garmentType },
    });
  }

  async getTaskStatus(providerTaskId: string): Promise<StatusResult> {
    const promise = this.tasks.get(providerTaskId);
    if (!promise) {
      return { status: "not_found" };
    }

    const result = await Promise.race([
      promise.then(() => "done" as const),
      new Promise<"generating">((resolve) => {
        setTimeout(() => resolve("generating"), 100);
      }),
    ]);

    if (result === "done") {
      try {
        const res = await promise;
        return { status: "done", raw: res };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { status: "failed", errorCode: "ARK_API_ERROR", errorMessage: msg, raw: e };
      }
    }

    return { status: "generating" };
  }

  async fetchResultImage(providerTaskId: string): Promise<ResultImage> {
    const promise = this.tasks.get(providerTaskId);
    if (!promise) {
      throw new ProviderError("NOT_FOUND", "任务不存在");
    }

    const result = await promise;

    const response = await fetch(result.url);
    if (!response.ok) {
      throw new ProviderError(
        "DOWNLOAD_FAILED",
        `下载结果失败: HTTP ${response.status}`
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/png";

    return { buffer, contentType };
  }

  private async callArkApi(params: SubmitParams): Promise<ArkResult> {
    await ensureMigrated();

    const personDataUri = await this.urlToDataUri(params.personImageUrl);
    const garmentDataUri = await this.urlToDataUri(params.garmentImageUrl);

    const body = {
      model: ARK_MODEL,
      prompt: "将图1的服装换为图2的服装",
      image: [personDataUri, garmentDataUri],
      sequential_image_generation: "disabled",
      response_format: "url",
      size: "2K",
      stream: false,
      watermark: true,
    };

    const response = await fetch(ARK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ProviderError(
        `ARK_HTTP_${response.status}`,
        `Ark API 返回错误: ${response.status} - ${text}`
      );
    }

    const data: ArkApiResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new ProviderError("NO_IMAGE", "Ark API 未返回图片");
    }

    return { url: data.data[0].url };
  }

  private async urlToDataUri(url: string): Promise<string> {
    const u = new URL(url);

    const fileId = u.pathname.split("/").pop();
    if (!fileId) {
      throw new ProviderError("INVALID_URL", "无法从 URL 提取文件 ID");
    }

    let storageKey: string | null = null;
    let contentType: string = "image/png";

    const uploadRows = await db
      .select({ storageKey: uploads.storageKey, contentType: uploads.contentType })
      .from(uploads)
      .where(eq(uploads.id, fileId))
      .limit(1);

    if (uploadRows.length > 0) {
      storageKey = uploadRows[0].storageKey;
      contentType = uploadRows[0].contentType || "image/png";
    } else {
      const resultRows = await db
        .select({ storageKey: tryonResults.storageKey })
        .from(tryonResults)
        .where(eq(tryonResults.id, fileId))
        .limit(1);

      if (resultRows.length > 0) {
        storageKey = resultRows[0].storageKey;
        contentType = "image/png";
      }
    }

    if (!storageKey) {
      throw new ProviderError("FILE_NOT_FOUND", `找不到文件: ${fileId}`);
    }

    const buffer = await localFsStorage.read(storageKey);
    if (!buffer) {
      throw new ProviderError("FILE_NOT_FOUND", `文件读取失败: ${storageKey}`);
    }

    const base64 = buffer.toString("base64");
    return `data:${contentType};base64,${base64}`;
  }
}
