import { NextRequest } from "next/server";
import {
  createOwnerProperty,
  isAuthUser,
  jsonError,
  listOwnerProperties,
  requireUser,
} from "@/lib/server/properties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    return Response.json(await listOwnerProperties(user));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    if (!body.name || !body.location || !body.listing_type) {
      return jsonError("Name, location and listing type are required", 400);
    }
    return Response.json(await createOwnerProperty(user, body));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}
