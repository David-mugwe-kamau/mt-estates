"use client";

import { Suspense } from "react";
import { ListingsBrowse } from "@/components/ListingsBrowse";

export default function RentalsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500">Loading rentals…</div>}>
      <ListingsBrowse
        listingType="rental"
        eyebrow="Public listings"
        title="Rental Properties"
        subtitle="Choose a county or Near me, then browse rental homes from landlords."
      />
    </Suspense>
  );
}
