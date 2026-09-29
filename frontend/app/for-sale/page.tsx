"use client";

import { Suspense } from "react";
import { ListingsBrowse } from "@/components/ListingsBrowse";

export default function ForSalePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500">Loading properties…</div>}>
      <ListingsBrowse
        listingType="for_sale"
        eyebrow="Approved by MT Estates"
        title="Properties For Sale"
        subtitle="All sale listings are reviewed for trust and authenticity."
      />
    </Suspense>
  );
}
