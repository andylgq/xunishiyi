import { env } from "@/lib/env";
import type { TryOnProvider } from "./provider";
import { MockTryOnProvider } from "./mock-adapter";
import { VolcanoTryOnProvider } from "./volcano-adapter";
import { ArkTryOnProvider } from "./ark-adapter";

let cached: TryOnProvider | null = null;

export function getProvider(): TryOnProvider {
  if (cached) return cached;
  if (env.TRYON_PROVIDER === "volcano") {
    if (!env.VOLC_ACCESS_KEY || !env.VOLC_SECRET_KEY) {
      throw new Error(
        "TRYON_PROVIDER=volcano 但 VOLC_ACCESS_KEY/VOLC_SECRET_KEY 未配置"
      );
    }
    cached = new VolcanoTryOnProvider(env.VOLC_ACCESS_KEY, env.VOLC_SECRET_KEY);
  } else if (env.TRYON_PROVIDER === "ark") {
    if (!env.ARK_API_KEY) {
      throw new Error("TRYON_PROVIDER=ark 但 ARK_API_KEY 未配置");
    }
    cached = new ArkTryOnProvider(env.ARK_API_KEY);
  } else {
    cached = new MockTryOnProvider();
  }
  return cached;
}

export function getProviderName(): string {
  return env.TRYON_PROVIDER;
}
