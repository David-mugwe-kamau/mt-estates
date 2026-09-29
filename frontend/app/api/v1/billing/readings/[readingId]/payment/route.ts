import { NextRequest } from "next/server";
import { jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser } from "@/lib/server/auth";
import { recordPayment } from "@/lib/server/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { readingId: string } },
) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    const data = await recordPayment(user, Number(params.readingId), Number(body.amount_paid || 0));
    if (!data) return jsonError("Reading not found", 404);
    return Response.json(data);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
