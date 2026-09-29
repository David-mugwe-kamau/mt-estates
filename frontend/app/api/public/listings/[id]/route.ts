import { NextResponse } from "next/server";
import { getPublicListingDetail } from "@/lib/publicListingsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ detail: "Listing not found" }, { status: 404 });
    }
    const item = await getPublicListingDetail(id);
    if (!item) {
      return NextResponse.json({ detail: "Listing not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load listing";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
