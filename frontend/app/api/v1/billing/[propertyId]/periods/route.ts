import { NextRequest } from "next/server";
import { jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser } from "@/lib/server/auth";
import { listPeriods } from "@/lib/server/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { propertyId: string } },
) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const data = await listPeriods(user, Number(params.propertyId));
    if (!data) return jsonError("Property not found", 404);
    return Response.json(data);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}
