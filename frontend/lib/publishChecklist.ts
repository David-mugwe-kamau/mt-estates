/** Same readiness rules as the publish guard — UI cues only, no new rules. */

export type PublishCheckItem = {
  id: "contact" | "type" | "ready_type";
  label: string;
  done: boolean;
};

type TypeLike = {
  is_vacant?: boolean | null;
  rent_amount?: number | null;
  min_rent?: number | null;
  images?: unknown[] | null;
};

export function buildPublishChecklist(input: {
  listingType: string | null | undefined;
  contactPhone?: string | null;
  contactWhatsapp?: string | null;
  types?: TypeLike[] | null;
}): PublishCheckItem[] {
  const phone = (input.contactPhone || "").trim();
  const wa = (input.contactWhatsapp || "").trim();
  const items: PublishCheckItem[] = [
    {
      id: "contact",
      label: "Viewing phone or WhatsApp",
      done: Boolean(phone || wa),
    },
  ];

  if (input.listingType === "rental" || input.listingType === "airbnb") {
    const types = input.types ?? [];
    items.push({
      id: "type",
      label: "At least one apartment type",
      done: types.length > 0,
    });
    const readyType = types.some(
      (t) =>
        t.is_vacant !== false &&
        (t.rent_amount != null || t.min_rent != null) &&
        (t.images?.length ?? 0) > 0,
    );
    items.push({
      id: "ready_type",
      label: "A vacant type with rent and at least one photo",
      done: readyType,
    });
  }

  return items;
}

/** Short line for My Listings when full type detail is not loaded. */
export function myListingsNeedsLine(p: {
  listing_type: string | null;
  is_published: boolean;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  image_url: string | null;
  type_count?: number | null;
  has_vacant_type?: boolean | null;
}): string | null {
  if (p.is_published) return null;
  const phone = (p.contact_phone || "").trim();
  const wa = (p.contact_whatsapp || "").trim();
  if (!phone && !wa) return "Add viewing contact to publish";

  if (p.listing_type === "rental" || p.listing_type === "airbnb") {
    if ((p.type_count ?? 0) === 0) return "Add type, rent & photos to publish";
    if (!p.image_url) return "Add type photos to publish";
    if (p.has_vacant_type === false) return null; // "Hidden" badge already covers this
  }

  if (!p.image_url && p.listing_type === "for_sale") return "Add photos to publish";
  return null;
}
