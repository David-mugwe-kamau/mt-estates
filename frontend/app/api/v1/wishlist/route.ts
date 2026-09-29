import { NextRequest } from "next/server";
import { jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser } from "@/lib/server/auth";
import { addWishlistItem, listWishlist } from "@/lib/server/wishlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    return Response.json(await listWishlist(user.id));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    if (!body.title || !body.listing_type) {
      return jsonError("title and listing_type are required", 400);
    }
    const item = await addWishlistItem(user, {
      title: String(body.title),
      location_text: body.location_text ?? null,
      listing_type: String(body.listing_type),
      notes: body.notes ?? null,
      external_ref: body.external_ref != null ? String(body.external_ref) : null,
      is_available: body.is_available ?? null,
    });
    return Response.json(item, { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
