import { NextRequest } from "next/server";
import { addImage, isAuthUser, jsonError, requireUser } from "@/lib/server/properties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    const image = await addImage(user, Number(params.id), {
      url: String(body.url || ""),
      is_cover: Boolean(body.is_cover),
      unit_type_id: body.unit_type_id ?? null,
    });
    if (!image) return jsonError("Property not found", 404);
    return Response.json(image, { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
