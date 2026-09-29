import { NextRequest } from "next/server";
import { jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser } from "@/lib/server/auth";
import { createViewing } from "@/lib/server/viewings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    const propertyId = Number(body.property_id);
    if (!Number.isFinite(propertyId)) return jsonError("property_id is required", 400);
    const item = await createViewing(user, {
      property_id: propertyId,
      preferred_date: body.preferred_date,
      message: body.message,
    });
    return Response.json(item, { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
