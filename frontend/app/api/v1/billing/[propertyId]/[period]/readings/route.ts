import { NextRequest } from "next/server";
import { jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser } from "@/lib/server/auth";
import { upsertReadings } from "@/lib/server/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { propertyId: string; period: string } },
) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    const data = await upsertReadings(user, Number(params.propertyId), params.period, {
      readings: body.readings || [],
      main_meter_reading: body.main_meter_reading,
    });
    if (!data) return jsonError("Property not found", 404);
    return Response.json(data);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
