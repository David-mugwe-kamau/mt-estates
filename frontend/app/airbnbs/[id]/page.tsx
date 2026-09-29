"use client";

import { PublicListingDetailPage } from "@/components/PublicListingDetailPage";

export default function AirbnbDetailPage({ params }: { params: { id: string } }) {
  return <PublicListingDetailPage id={params.id} type="airbnb" />;
}
