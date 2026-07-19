export type ProviderTaskStatus =
  | "in_queue"
  | "generating"
  | "done"
  | "not_found"
  | "failed";

export interface SubmitParams {
  personImageUrl: string;
  garmentImageUrl: string;
  garmentType: "upper" | "outer";
  seed: number;
  keepHead?: boolean;
}

export interface SubmitResult {
  providerTaskId: string;
  raw?: unknown;
}

export interface StatusResult {
  status: ProviderTaskStatus;
  errorCode?: string;
  errorMessage?: string;
  raw?: unknown;
}

export interface ResultImage {
  buffer: Buffer;
  contentType: string;
}

export interface TryOnProvider {
  readonly name: string;
  submitTask(params: SubmitParams): Promise<SubmitResult>;
  getTaskStatus(providerTaskId: string): Promise<StatusResult>;
  fetchResultImage(providerTaskId: string): Promise<ResultImage>;
  cancelTask?(providerTaskId: string): Promise<void>;
}

/** provider 状态 → 是否终态 */
export function isProviderTerminal(s: ProviderTaskStatus): boolean {
  return s === "done" || s === "not_found" || s === "failed";
}
