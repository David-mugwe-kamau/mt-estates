import { NextRequest, NextResponse } from "next/server";
import { listPublicListings } from "@/lib/publicListingsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numParam(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const items = await listPublicListings({
      listing_type: sp.get("listing_type"),
      location: sp.get("location"),
      county: sp.get("county"),
      locality: sp.get("locality"),
      min_price: numParam(sp.get("min_price")),
      max_price: numParam(sp.get("max_price")),
      lat: numParam(sp.get("lat")),
      lng: numParam(sp.get("lng")),
      radius_km: numParam(sp.get("radius")) ?? 20,
      category: sp.get("category"),
    });
    return NextResponse.json(items);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load listings";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
