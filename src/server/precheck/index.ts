import { runBaseRules, type Check, type PrecheckInput } from "./rules-engine";
import { aiPersonChecks, aiGarmentChecks } from "./ai-checker";

export interface PrecheckResult {
  passed: boolean;
  checks: Check[];
  summary: string;
}

export async function runPrecheck(
  input: PrecheckInput
): Promise<PrecheckResult> {
  const checks: Check[] = [];
  checks.push(...(await runBaseRules(input)));
  if (input.role === "person") {
    checks.push(...(await aiPersonChecks()));
  } else {
    checks.push(...(await aiGarmentChecks()));
  }
  const passed = checks.every(
    (c) => c.severity === "warn" || c.passed
  );
  const failed = checks.filter((c) => !(c.severity === "warn" || c.passed));
  const summary = failed.length
    ? failed.map((f) => f.reason || f.name).join("；")
    : "预检通过";
  return { passed, checks, summary };
}

export type { Check, PrecheckInput } from "./rules-engine";
export { getImageMeta } from "./rules-engine";
