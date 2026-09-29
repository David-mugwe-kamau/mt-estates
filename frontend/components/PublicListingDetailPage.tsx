"use client";

import { useEffect, useState } from "react";
import { listings } from "@/lib/api";
import { PropertyDetail, type PropertyDetailData } from "@/components/PropertyDetail";

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#005B8E"/><stop offset="1" stop-color="#F47920"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/></svg>`,
  );

function formatPrice(minRent: number | null, type: string): string {
  if (minRent == null) return "Price on request";
  const amount = `KSh ${Number(minRent).toLocaleString("en-KE")}`;
  if (type === "airbnb") return `${amount} / night`;
  if (type === "for_sale") return amount;
  return `${amount} / month`;
}

export function PublicListingDetailPage({
  id,
  type,
}: {
  id: string;
  type: "rental" | "airbnb" | "for_sale";
}) {
  const [property, setProperty] = useState<PropertyDetailData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const back = type === "airbnb" ? "/airbnbs" : type === "for_sale" ? "/for-sale" : "/rentals";

  useEffect(() => {
    const listingId = Number(id);
    if (!listingId) {
      setError("Invalid listing");
      setLoading(false);
      return;
    }
    listings
      .get(listingId)
      .then(async (data) => {
        let similar: PropertyDetailData["similar"] = [];
        try {
          const all = await listings.public({ listing_type: type, location: data.location.split(",")[0]?.trim() });
          similar = all
            .filter((x) => x.id !== data.id)
            .slice(0, 4)
            .map((x) => ({
              id: x.id,
              name: x.name,
              location: x.location,
              image_url: x.image_url,
              min_rent: x.min_rent,
            }));
        } catch {
          similar = [];
        }
        setProperty({
          id: data.id,
          title: data.name,
          location: data.location,
          price: formatPrice(data.min_rent, type),
          image: data.image_url || PLACEHOLDER,
          description: data.description,
          contactPhone: data.contact_phone,
          contactWhatsapp: data.contact_whatsapp,
          latitude: data.latitude,
          longitude: data.longitude,
          type,
          images: data.images,
          unitTypes: data.unit_types,
          similar,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Listing not found"))
      .finally(() => setLoading(false));
  }, [id, type]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-mt-blue border-t-transparent" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{error || "Listing not found"}</h1>
        <a href={back} className="mt-4 inline-block text-mt-blue hover:text-mt-orange">← Back</a>
      </div>
    );
  }

  return <PropertyDetail property={property} />;
}
