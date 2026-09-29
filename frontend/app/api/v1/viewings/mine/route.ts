import { NextRequest } from "next/server";
import { jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser } from "@/lib/server/auth";
import { listMyViewings } from "@/lib/server/viewings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    return Response.json(await listMyViewings(user.id));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}
