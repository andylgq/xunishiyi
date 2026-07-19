export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public extra?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "参数错误", extra?: unknown) {
    super("VALIDATION_ERROR", message, 400, extra);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "请先登录") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class PrecheckError extends AppError {
  constructor(message: string, extra?: unknown) {
    super("PRECHECK_FAILED", message, 422, extra);
  }
}

export class QuotaExceededError extends AppError {
  constructor() {
    super("QUOTA_EXCEEDED", "今日试衣次数已用完", 402);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "资源不存在") {
    super("NOT_FOUND", message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "当前状态不允许该操作") {
    super("CONFLICT", message, 409);
  }
}

export class ProviderError extends AppError {
  constructor(providerCode: string, message: string) {
    super("PROVIDER_ERROR", message, 502, { providerCode });
  }
}

export function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: {
        error: {
          code: err.code,
          message: err.message,
          ...(err.extra ? { details: err.extra } : {}),
        },
      },
    };
  }
  console.error("[unhandled]", err);
  return {
    status: 500,
    body: {
      error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
    },
  };
}
