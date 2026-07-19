import { toErrorResponse } from "@/lib/errors";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;

/**
 * 包裹 Route Handler：统一 try/catch → toErrorResponse。
 * 动态参数通过 ctx.params（Next 15 为 Promise）传入。
 */
export function apiHandler(fn: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return Response.json(body, { status });
    }
  };
}

export function jsonOk(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}
