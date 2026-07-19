import crypto from "node:crypto";
import type {
  TryOnProvider,
  SubmitParams,
  SubmitResult,
  StatusResult,
  ResultImage,
  ProviderTaskStatus,
} from "./provider";
import { ProviderError } from "@/lib/errors";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * 火山引擎智能视觉服务「图片换装 V2」适配器。
 *
 * 接口（基于公开文档）：
 *   提交：POST {ENDPOINT}?Action=CVSubmitTask&Version=2022-08-31
 *        Body req_key=dressing_diffusionV2, model.url, garment.data[].url/type, inference_config.seed/keep_head
 *   查询：POST {ENDPOINT}?Action=CVGetResult&Version=2022-08-31
 *        Body { req_key, task_id }
 *   成功码：code=10000
 *
 * [待确认] 点（需用户文档/Key 验证）：
 *   1. CVGetResult 返回的 data.status 取值全集（这里用 done/not_found/in_queue/generating 推断）
 *   2. 错误码表（尤其 50xxx、内容审核、配额）
 *   3. 是否支持单次返回多张（决定是否必须并发 3 任务）——当前按"单次 1 张"处理
 *   4. 是否有 CancelTask 接口
 *   5. QPS / 并发限制
 *   6. 结果字段名（image_urls / image_url / binary_data_base64）
 *
 * 签名：火山引擎 HMAC-SHA256 v4（与 AWS v4 类似，但不加 "AWS4" 前缀）。
 * 本文件为草案，真实接入需用用户提供的文档与 Key 验证后校正。
 */
const ENDPOINT = env.VOLC_ENDPOINT;
const REGION = env.VOLC_REGION;
const SERVICE = env.VOLC_SERVICE;
const REQ_KEY = env.VOLC_REQ_KEY;

export class VolcanoTryOnProvider implements TryOnProvider {
  readonly name = "volcano";

  constructor(private ak: string, private sk: string) {}

  async submitTask(p: SubmitParams): Promise<SubmitResult> {
    const body = {
      req_key: REQ_KEY,
      req_image_store_type: 1, // URL 模式
      model: { url: p.personImageUrl },
      garment: { data: [{ url: p.garmentImageUrl, type: mapGarmentType(p.garmentType) }] },
      inference_config: {
        seed: p.seed,
        keep_head: p.keepHead ?? true,
      },
      return_url: true,
    };
    const res = await this.call("CVSubmitTask", "2022-08-31", body);
    if (res.code !== 10000) {
      throw new ProviderError(String(res.code), res.message || "volcano submit failed");
    }
    const taskId = res.data?.task_id;
    if (!taskId) throw new ProviderError("NO_TASK_ID", "未返回 task_id");
    return { providerTaskId: taskId, raw: res };
  }

  async getTaskStatus(providerTaskId: string): Promise<StatusResult> {
    const res = await this.call("CVGetResult", "2022-08-31", {
      req_key: REQ_KEY,
      task_id: providerTaskId,
    });
    if (res.code === 10000) {
      return { status: "done", raw: res };
    }
    // [待确认] code 与 data.status 映射
    const dataStatus = res.data?.status as string | undefined;
    const status = mapStatus(res.code, dataStatus);
    return {
      status,
      errorCode: String(res.code),
      errorMessage: res.message,
      raw: res,
    };
  }

  async fetchResultImage(providerTaskId: string): Promise<ResultImage> {
    // done 时再次查询取图（CVGetResult done 返回 image_urls）
    const res = await this.call("CVGetResult", "2022-08-31", {
      req_key: REQ_KEY,
      task_id: providerTaskId,
    });
    if (res.code !== 10000) {
      throw new ProviderError(String(res.code), res.message || "result not ready");
    }
    // [待确认] 字段名：优先 image_urls[0]，其次 image_url，最后 binary_data_base64
    const imageUrl: string | undefined =
      res.data?.image_urls?.[0] ?? res.data?.image_url;
    if (imageUrl) {
      const r = await fetch(imageUrl);
      if (!r.ok) throw new ProviderError("DOWNLOAD_FAILED", `下载结果失败 ${r.status}`);
      const buffer = Buffer.from(await r.arrayBuffer());
      const contentType = r.headers.get("content-type") || "image/png";
      return { buffer, contentType };
    }
    const b64: string | undefined = res.data?.binary_data_base64?.[0] ?? res.data?.binary_data_base64;
    if (b64) {
      return { buffer: Buffer.from(b64, "base64"), contentType: "image/png" };
    }
    throw new ProviderError("NO_IMAGE", "结果中未找到图片");
  }

  private async call(action: string, version: string, body: unknown): Promise<any> {
    const url = `${ENDPOINT}?Action=${action}&Version=${version}`;
    const bodyStr = JSON.stringify(body);
    const headers = signVolcanoRequest({
      ak: this.ak,
      sk: this.sk,
      method: "POST",
      url,
      body: bodyStr,
      region: REGION,
      service: SERVICE,
    });
    headers["Content-Type"] = "application/json";
    const r = await fetch(url, { method: "POST", headers, body: bodyStr });
    if (!r.ok) {
      throw new ProviderError(`HTTP_${r.status}`, `volcano http ${r.status}`);
    }
    return r.json();
  }
}

function mapGarmentType(t: SubmitParams["garmentType"]): string {
  // 火山引擎 garment.type: upper / bottom / full。V1 仅上衣/外套，统一映射 upper。
  return "upper";
}

function mapStatus(code: number, dataStatus?: string): ProviderTaskStatus {
  if (dataStatus === "done") return "done";
  if (dataStatus === "not_found") return "not_found";
  if (dataStatus === "in_queue" || dataStatus === "generating") return dataStatus;
  // [待确认] code 50xxx 通常为处理中/排队
  logger.warn(`[volcano] 未映射的 code=${code} dataStatus=${dataStatus}`);
  return "generating";
}

/* ----------------------------- 火山引擎 v4 签名 ----------------------------- */
// 参考：https://www.volcengine.com/docs/6369/67269
interface SignParams {
  ak: string;
  sk: string;
  method: string;
  url: string;
  body: string;
  region: string;
  service: string;
}

function signVolcanoRequest(p: SignParams): Record<string, string> {
  const u = new URL(p.url);
  const now = new Date();
  const xDate = toISOStringBasic(now); // YYYYMMDDTHHMMSSZ
  const shortDate = xDate.slice(0, 8);

  // 1. CanonicalRequest
  const canonicalUri = u.pathname || "/";
  const canonicalQuery = canonicalQueryString(u);
  const signedHeaderNames = ["content-type", "host", "x-content-sha256", "x-date"];
  const canonicalHeaders = signedHeaderNames
    .map((h) => `${h}:${headerValue(h, u, p.body, xDate)}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");
  const payloadHash = sha256Hex(p.body);
  const canonicalRequest = [
    p.method.toUpperCase(),
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  // 2. StringToSign
  const credentialScope = `${shortDate}/${p.region}/${p.service}/request`;
  const stringToSign = [
    "HMAC-SHA256",
    xDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  // 3. SigningKey
  const kDate = hmac(sk2buf(p.sk), shortDate);
  const kRegion = hmac(kDate, p.region);
  const kService = hmac(kRegion, p.service);
  const kSigning = hmac(kService, "request");

  // 4. Signature
  const signature = hmacHex(kSigning, stringToSign);

  const authorization =
    `HMAC-SHA256 Credential=${p.ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Host: u.host,
    "X-Date": xDate,
    "X-Content-Sha256": payloadHash,
    Authorization: authorization,
  };
}

function headerValue(name: string, u: URL, body: string, xDate: string): string {
  switch (name) {
    case "content-type":
      return "application/json";
    case "host":
      return u.host;
    case "x-content-sha256":
      return sha256Hex(body);
    case "x-date":
      return xDate;
    default:
      return "";
  }
}

function canonicalQueryString(u: URL): string {
  const params = Array.from(u.searchParams.entries())
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return params.map(([k, v]) => `${k}=${v}`).join("&");
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}
function hmacHex(key: Buffer, data: string): string {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest("hex");
}
function sk2buf(sk: string): Buffer {
  return Buffer.from(sk, "utf8");
}
function toISOStringBasic(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  const p = d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return p;
}
