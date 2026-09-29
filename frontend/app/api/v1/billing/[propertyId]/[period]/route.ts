import { NextRequest } from "next/server";
import { jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser } from "@/lib/server/auth";
import { getStatement } from "@/lib/server/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { propertyId: string; period: string } },
) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const data = await getStatement(user, Number(params.propertyId), params.period);
    if (!data) return jsonError("Property not found", 404);
    return Response.json(data);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}
