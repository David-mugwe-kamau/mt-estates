import { NextRequest } from "next/server";
import { jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser } from "@/lib/server/auth";
import { updateViewingStatus } from "@/lib/server/viewings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    const item = await updateViewingStatus(user.id, Number(params.id), String(body.status || ""));
    if (!item) return jsonError("Viewing not found", 404);
    return Response.json(item);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
