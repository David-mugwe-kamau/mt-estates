"use client";

import { PublicListingDetailPage } from "@/components/PublicListingDetailPage";

export default function RentalDetailPage({ params }: { params: { id: string } }) {
  return <PublicListingDetailPage id={params.id} type="rental" />;
}
