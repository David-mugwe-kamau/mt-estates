"use client";

import { PublicListingDetailPage } from "@/components/PublicListingDetailPage";

export default function ForSaleDetailPage({ params }: { params: { id: string } }) {
  return <PublicListingDetailPage id={params.id} type="for_sale" />;
}
