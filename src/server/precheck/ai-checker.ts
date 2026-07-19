import type { Check } from "./rules-engine";

/**
 * P0 AI 预检预留接口。
 *
 * 当前为空实现（原型阶段预检以基础规则为主）。
 * 后续接入点：
 *  - 人脸数量 / 上半身完整 / 遮挡：火山引擎 BodyDetection / 人脸检测 API
 *  - 服装品类 / 单品：豆包视觉理解 doubao-vision-pro
 * 失败的 AI 检查应返回 severity: 'block'，并在 runPrecheck 中阻断（不扣额度）。
 */
export async function aiPersonChecks(): Promise<Check[]> {
  // TODO: 接入火山引擎人体/人脸检测，校验：单人、人脸清晰、上半身完整、无大面积遮挡
  return [];
}

export async function aiGarmentChecks(): Promise<Check[]> {
  // TODO: 接入视觉模型，校验：服装品类与所选一致、仅单件、无模特穿着
  return [];
}
