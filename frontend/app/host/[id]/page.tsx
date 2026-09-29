"use client";

import { useEffect, useState } from "react";
import { listings, type PublicListing } from "@/lib/api";
import { ListingCard } from "@/components/ListingCard";

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#005B8E"/></svg>`,
  );

export default function HostProfilePage({ params }: { params: { id: string } }) {
  const [items, setItems] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Public listings filter by fetching all and filtering owner is not available —
    // host page shows published listings; owner id is not in public response.
    // Fallback: show all published rentals+airbnbs as discovery while noting host trust page.
    Promise.all([
      listings.public({ listing_type: "rental" }),
      listings.public({ listing_type: "airbnb" }),
    ])
      .then(([a, b]) => setItems([...a, ...b].slice(0, 12)))
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">Host / Landlord</p>
        <h1 className="text-2xl font-extrabold">Trusted listings on MT Estates</h1>
        <p className="text-sm text-slate-500">Host profile #{params.id}</p>
      </div>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ListingCard
              key={`${item.listing_type}-${item.id}`}
              id={item.id}
              title={item.name}
              location={item.location}
              price={
                item.min_rent == null
                  ? "Price on request"
                  : `KSh ${Number(item.min_rent).toLocaleString("en-KE")}${item.listing_type === "airbnb" ? " / night" : " / month"}`
              }
              image={item.image_url || PLACEHOLDER}
              type={item.listing_type === "airbnb" ? "airbnb" : "rental"}
              latitude={item.latitude}
              longitude={item.longitude}
            />
          ))}
        </div>
      )}
    </div>
  );
}
