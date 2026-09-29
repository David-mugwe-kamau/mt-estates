import { NextRequest } from "next/server";
import { isAuthUser, jsonError, requireUser, setListingCover } from "@/lib/server/properties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    const item = await setListingCover(user, Number(params.id), Number(body.image_id));
    return Response.json(item);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
