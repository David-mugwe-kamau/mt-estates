import { NextRequest } from "next/server";
import {
  isAuthUser,
  jsonError,
  removeUnitType,
  requireUser,
  updateUnitType,
} from "@/lib/server/properties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; typeId: string } },
) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    const types = await updateUnitType(user, Number(params.id), Number(params.typeId), body);
    if (!types) return jsonError("Type not found", 404);
    const updated = types.find((t) => t.id === Number(params.typeId)) || types[0];
    return Response.json(updated);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; typeId: string } },
) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const ok = await removeUnitType(user, Number(params.id), Number(params.typeId));
    if (!ok) return jsonError("Type not found", 404);
    return Response.json({ message: "Type removed" });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
