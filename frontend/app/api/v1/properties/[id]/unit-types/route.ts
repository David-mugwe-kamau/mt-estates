import { NextRequest } from "next/server";
import {
  addUnitType,
  isAuthUser,
  jsonError,
  requireUser,
  serializeUnitTypes,
} from "@/lib/server/properties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    const types = await addUnitType(user, Number(params.id), body);
    const created = types[types.length - 1];
    return Response.json(created, { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
