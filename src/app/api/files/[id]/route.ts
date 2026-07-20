import { eq, and } from "drizzle-orm";
import { ensureMigrated } from "@/db/ensure-migrated";
import { db } from "@/db/drizzle";
import { uploads, tryonResults } from "@/db/schema";
import { verifyFileToken } from "@/lib/jwt";
import { storage } from "@/server/storage/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "缺少 token" } },
      { status: 401 }
    );
  }
  const fileId = await verifyFileToken(token);
  if (!fileId || fileId !== id) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "token 无效" } },
      { status: 401 }
    );
  }

  await ensureMigrated();
  const now = new Date();

  // 先查 uploads
  const uploadRows = await db
    .select()
    .from(uploads)
    .where(
      and(
        eq(uploads.id, id),
        eq(uploads.isDeleted, false)
      )
    )
    .limit(1);
  const upload = uploadRows[0];
  if (upload && upload.expiresAt > now) {
    const buf = await storage.read(upload.storageKey);
    if (!buf) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "文件不存在" } },
        { status: 404 }
      );
    }
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": upload.contentType,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // 再查 tryon_results
  const resultRows = await db
    .select()
    .from(tryonResults)
    .where(
      and(
        eq(tryonResults.id, id),
        eq(tryonResults.isDeleted, false)
      )
    )
    .limit(1);
  const result = resultRows[0];
  if (result && result.expiresAt > now && result.storageKey) {
    const buf = await storage.read(result.storageKey);
    if (!buf) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "文件不存在" } },
        { status: 404 }
      );
    }
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    });
  }

  return Response.json(
    { error: { code: "NOT_FOUND", message: "文件不存在或已过期" } },
    { status: 404 }
  );
}
