"use client";

import { Suspense } from "react";
import { ListingsBrowse } from "@/components/ListingsBrowse";

export default function AirbnbsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500">Loading Airbnbs…</div>}>
      <ListingsBrowse
        listingType="airbnb"
        eyebrow="Short stays"
        title="Airbnb Listings"
        subtitle="Find trusted short-stay spaces by location and style."
      />
    </Suspense>
  );
}
