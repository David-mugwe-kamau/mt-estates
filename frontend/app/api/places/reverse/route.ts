import { NextRequest, NextResponse } from "next/server";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const UA = "MTEstates/1.0 (Kenya property listings; local-dev)";

/** Reverse-geocode a map pin to a readable Kenya place name. */
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng) {
    return NextResponse.json({ detail: "lat and lng required" }, { status: 400 });
  }

  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lng);
  url.searchParams.set("zoom", "16");
  url.searchParams.set("addressdetails", "0");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json({ detail: "Reverse geocode failed" }, { status: 502 });
    }
    const raw = (await res.json()) as { display_name?: string };
    return NextResponse.json({
      display_name: raw.display_name || `${lat}, ${lng}`,
      lat: Number(lat),
      lng: Number(lng),
    });
  } catch {
    return NextResponse.json({ detail: "Reverse geocode unavailable" }, { status: 502 });
  }
}
