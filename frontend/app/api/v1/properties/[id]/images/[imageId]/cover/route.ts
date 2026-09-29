import { NextRequest } from "next/server";
import { isAuthUser, jsonError, requireUser, setCover } from "@/lib/server/properties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH .../images/:imageId/cover */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; imageId: string } },
) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const image = await setCover(user, Number(params.id), Number(params.imageId));
    if (!image) return jsonError("Image not found", 404);
    return Response.json(image);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}
