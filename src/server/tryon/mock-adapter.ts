import sharp from "sharp";
import { nanoid } from "nanoid";
import type {
  TryOnProvider,
  SubmitParams,
  SubmitResult,
  StatusResult,
  ResultImage,
} from "./provider";

const MOCK_DELAY_MS = 3000;

/**
 * 开发用 mock provider：不调用任何外部服务。
 * - 提交后约 3 秒进入 done
 * - 结果图用 sharp 生成的 SVG 占位图（不同 seed 不同色调）
 * 用于无 API Key 时跑通完整流程。
 */
export class MockTryOnProvider implements TryOnProvider {
  readonly name = "mock";

  submitTask(params: SubmitParams): Promise<SubmitResult> {
    const id = `${Date.now()}-${nanoid(8)}`;
    return Promise.resolve({
      providerTaskId: id,
      raw: { seed: params.seed, garmentType: params.garmentType },
    });
  }

  async getTaskStatus(id: string): Promise<StatusResult> {
    const ts = Number(id.split("-")[0]);
    if (!Number.isFinite(ts)) return { status: "not_found" };
    if (Date.now() - ts < MOCK_DELAY_MS) return { status: "generating" };
    return { status: "done" };
  }

  async fetchResultImage(id: string): Promise<ResultImage> {
    const seedPart = id.split("-")[0];
    const hue = Number(seedPart.slice(-4)) % 360;
    const buffer = await makePlaceholder(hue, id);
    return { buffer, contentType: "image/png" };
  }
}

async function makePlaceholder(hue: number, label: string): Promise<Buffer> {
  const bg = `hsl(${hue} 65% 88%)`;
  const fg = `hsl(${hue} 70% 28%)`;
  const tag = label.slice(-8);
  const svg = `<svg width="512" height="640" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="640" fill="${bg}"/>
  <text x="256" y="300" font-size="30" font-family="sans-serif" fill="${fg}" text-anchor="middle">虚拟试衣占位图</text>
  <text x="256" y="345" font-size="18" font-family="sans-serif" fill="${fg}" text-anchor="middle">mock · ${tag}</text>
  <text x="256" y="560" font-size="14" font-family="sans-serif" fill="${fg}" text-anchor="middle">结果仅供视觉参考</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
