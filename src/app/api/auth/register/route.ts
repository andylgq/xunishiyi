import { NextRequest } from "next/server";
import { apiHandler, jsonOk } from "@/app/api/_lib/handler";
import { register, type RegisterInput } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const body = (await req.json()) as RegisterInput;
    const user = await register(body);
    return jsonOk({
      userId: user.userId,
      email: user.email,
      isAnonymous: user.isAnonymous,
    });
  });
}
