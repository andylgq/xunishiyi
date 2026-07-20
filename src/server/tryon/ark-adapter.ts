import { eq } from "drizzle-orm";
import type {
  TryOnProvider,
  SubmitParams,
  SubmitResult,
  StatusResult,
  ResultImage,
} from "./provider";
import { ProviderError } from "@/lib/errors";
import { db } from "@/db/drizzle";
import { uploads, tryonResults } from "@/db/schema";
import { ensureMigrated } from "@/db/ensure-migrated";
import { storage } from "@/server/storage/storage";

const ARK_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const ARK_MODEL = "doubao-seedream-5-0-260128";
const ARK_RESULT_PREFIX = "ark-result:";

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

function encodeProviderTaskId(url: string): string {
  return `${ARK_RESULT_PREFIX}${Buffer.from(url, "utf8").toString("base64url")}`;
}

function decodeProviderTaskId(providerTaskId: string): ArkResult | null {
  if (!providerTaskId.startsWith(ARK_RESULT_PREFIX)) return null;

  try {
    const url = Buffer.from(
      providerTaskId.slice(ARK_RESULT_PREFIX.length),
      "base64url"
    ).toString("utf8");
    return { url };
  } catch {
    return null;
  }
}

export class ArkTryOnProvider implements TryOnProvider {
  readonly name = "ark";

  constructor(private apiKey: string) {}

  async submitTask(params: SubmitParams): Promise<SubmitResult> {
    const result = await this.callArkApi(params);

    return {
      providerTaskId: encodeProviderTaskId(result.url),
      raw: { seed: params.seed, garmentType: params.garmentType },
    };
  }

  async getTaskStatus(providerTaskId: string): Promise<StatusResult> {
    const result = decodeProviderTaskId(providerTaskId);
    if (!result) {
      return { status: "not_found" };
    }

    return { status: "done", raw: result };
  }

  async fetchResultImage(providerTaskId: string): Promise<ResultImage> {
    const result = decodeProviderTaskId(providerTaskId);
    if (!result) {
      throw new ProviderError("NOT_FOUND", "任务不存在");
    }

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
      prompt: "将图1中的人物换上图2中的服装，保持人物身份、姿态和背景自然。",
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
    let contentType = "image/png";

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
      }
    }

    if (!storageKey) {
      throw new ProviderError("FILE_NOT_FOUND", `找不到文件: ${fileId}`);
    }

    const buffer = await storage.read(storageKey);
    if (!buffer) {
      throw new ProviderError("FILE_NOT_FOUND", `文件读取失败: ${storageKey}`);
    }

    const base64 = buffer.toString("base64");
    return `data:${contentType};base64,${base64}`;
  }
}
