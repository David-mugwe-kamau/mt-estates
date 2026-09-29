import { NextRequest } from "next/server";
import { jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser } from "@/lib/server/auth";
import { deleteWishlistItem } from "@/lib/server/wishlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const ok = await deleteWishlistItem(user.id, Number(params.id));
    if (!ok) return jsonError("Item not found", 404);
    return new Response(null, { status: 204 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}
