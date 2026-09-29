import { NextRequest } from "next/server";
import {
  getOwnerProperty,
  isAuthUser,
  jsonError,
  requireUser,
  softDeleteOwnerProperty,
  updateOwnerProperty,
} from "@/lib/server/properties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const item = await getOwnerProperty(user, Number(params.id));
    if (!item) return jsonError("Property not found", 404);
    return Response.json(item);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    const item = await updateOwnerProperty(user, Number(params.id), body);
    if (!item) return jsonError("Property not found", 404);
    return Response.json(item);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const ok = await softDeleteOwnerProperty(user, Number(params.id));
    if (!ok) return jsonError("Property not found", 404);
    return Response.json({ message: "Listing deleted" });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}
