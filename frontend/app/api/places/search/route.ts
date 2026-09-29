import { NextRequest, NextResponse } from "next/server";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const UA = "MTEstates/1.0 (Kenya property listings; local-dev)";

export type PlaceResult = {
  display_name: string;
  lat: number;
  lng: number;
};

/** Kenya-biased place search via OpenStreetMap Nominatim. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("format", "json");
  url.searchParams.set("q", q);
  url.searchParams.set("countrycodes", "ke");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("limit", "6");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json({ detail: "Place search failed" }, { status: 502 });
    }
    const raw = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
    const places: PlaceResult[] = raw.map((r) => ({
      display_name: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }));
    return NextResponse.json(places);
  } catch {
    return NextResponse.json({ detail: "Place search unavailable" }, { status: 502 });
  }
}
