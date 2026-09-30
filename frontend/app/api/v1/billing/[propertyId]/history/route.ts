import { NextRequest } from "next/server";
import { jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser } from "@/lib/server/auth";
import { getHistory } from "@/lib/server/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { propertyId: string } },
) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  const from = req.nextUrl.searchParams.get("from") || "";
  const to = req.nextUrl.searchParams.get("to") || "";
  try {
    const data = await getHistory(user, Number(params.propertyId), from, to);
    if (!data) return jsonError("Property not found", 404);
    return Response.json(data);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
