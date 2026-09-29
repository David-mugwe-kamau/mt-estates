/**
 * Public listings from Supabase Postgres (same tables FastAPI uses).
 * Server-only — uses DATABASE_URL, never exposed to the browser.
 * Response shapes match /api/v1/listings so the UI does not change.
 */
import { Pool, type QueryResultRow } from "pg";

const UNIT_CATEGORY_LABELS: Record<string, string> = {
  single_room: "Single room",
  double_room: "Double room",
  bedsitter: "Bedsitter / studio",
  one_bedroom: "1 bedroom",
  two_bedroom: "2 bedroom",
  three_bedroom: "3 bedroom",
  four_bedroom: "4 bedroom",
  five_bedroom_plus: "5 bedroom+",
  maisonette: "Maisonette",
  bungalow: "Bungalow",
  townhouse: "Townhouse",
  penthouse: "Penthouse",
  sq: "SQ / backyard unit",
  shared_room: "Shared / hostel room",
  other: "Other",
};

let pool: Pool | null = null;

function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (needed for public listings without Render)");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      ssl: url.includes("supabase") || url.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
      max: 5,
      connectionTimeoutMillis: 12_000,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

function displayLabel(category: string, customLabel: string | null): string {
  if (category === "other" && customLabel?.trim()) return customLabel.trim();
  return UNIT_CATEGORY_LABELS[category] || category;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type PublicListParams = {
  listing_type?: string | null;
  location?: string | null;
  county?: string | null;
  locality?: string | null;
  min_price?: number | null;
  max_price?: number | null;
  lat?: number | null;
  lng?: number | null;
  radius_km?: number;
  category?: string | null;
};

type UnitTypeRow = {
  id: number;
  property_id: number;
  category: string;
  custom_label: string | null;
  rent_amount: unknown;
  is_vacant: boolean;
  sort_order: number;
  created_at: string;
};

type UnitRow = {
  id: number;
  property_id: number;
  unit_type_id: number | null;
  rent_amount: unknown;
  status: string;
  is_unused: boolean;
};

type ImageRow = {
  id: number;
  property_id: number;
  url: string;
  sort_order: number;
  is_cover: boolean;
  unit_type_id: number | null;
  is_unused: boolean;
  unused_at: string | null;
  created_at: string;
};

type PropRow = QueryResultRow & {
  id: number;
  name: string;
  location: string;
  county: string | null;
  locality: string | null;
  listing_type: string | null;
  description: string | null;
  image_url: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  latitude: number | null;
  longitude: number | null;
  cover_image_id: number | null;
  view_count: number;
};

function serializeImage(i: ImageRow) {
  return {
    id: i.id,
    property_id: i.property_id,
    url: i.url,
    sort_order: i.sort_order,
    is_cover: i.is_cover,
    unit_type_id: i.unit_type_id,
    is_unused: i.is_unused ?? false,
    unused_at: i.unused_at,
    created_at: i.created_at,
  };
}

async function loadRelated(propertyIds: number[]) {
  if (propertyIds.length === 0) {
    return {
      typesByProp: new Map<number, UnitTypeRow[]>(),
      unitsByProp: new Map<number, UnitRow[]>(),
      imagesByProp: new Map<number, ImageRow[]>(),
    };
  }
  const db = getPool();
  const [typesRes, unitsRes, imagesRes] = await Promise.all([
    db.query<UnitTypeRow>(
      `SELECT id, property_id, category, custom_label, rent_amount, is_vacant, sort_order, created_at
       FROM unit_types WHERE property_id = ANY($1::int[])
       ORDER BY sort_order, id`,
      [propertyIds],
    ),
    db.query<UnitRow>(
      `SELECT id, property_id, unit_type_id, rent_amount, status, is_unused
       FROM units WHERE property_id = ANY($1::int[]) AND COALESCE(is_unused, false) = false`,
      [propertyIds],
    ),
    db.query<ImageRow>(
      `SELECT id, property_id, url, sort_order, is_cover, unit_type_id, is_unused, unused_at, created_at
       FROM property_images WHERE property_id = ANY($1::int[]) AND COALESCE(is_unused, false) = false
       ORDER BY sort_order, id`,
      [propertyIds],
    ),
  ]);

  const typesByProp = new Map<number, UnitTypeRow[]>();
  for (const t of typesRes.rows) {
    const list = typesByProp.get(t.property_id) || [];
    list.push(t);
    typesByProp.set(t.property_id, list);
  }
  const unitsByProp = new Map<number, UnitRow[]>();
  for (const u of unitsRes.rows) {
    const list = unitsByProp.get(u.property_id) || [];
    list.push(u);
    unitsByProp.set(u.property_id, list);
  }
  const imagesByProp = new Map<number, ImageRow[]>();
  for (const i of imagesRes.rows) {
    const list = imagesByProp.get(i.property_id) || [];
    list.push(i);
    imagesByProp.set(i.property_id, list);
  }
  return { typesByProp, unitsByProp, imagesByProp };
}

function coverUrl(prop: PropRow, images: ImageRow[]): string | null {
  if (images.length) {
    const cover = images.find((i) => i.is_cover) || images[0];
    return cover.url;
  }
  if (prop.image_url && prop.image_url.length >= 32) return prop.image_url;
  return null;
}

function minRentForTypes(
  types: UnitTypeRow[],
  units: UnitRow[],
  vacantOnly: boolean,
): number | null {
  const use = vacantOnly ? types.filter((t) => t.is_vacant) : types;
  const typeRents = use.map((t) => num(t.rent_amount)).filter((n): n is number => n != null);
  if (typeRents.length) return Math.min(...typeRents);
  const vacantIds = new Set(use.map((t) => t.id));
  const unitRents = units
    .filter((u) => (vacantOnly ? u.unit_type_id != null && vacantIds.has(u.unit_type_id) : true))
    .map((u) => num(u.rent_amount))
    .filter((n): n is number => n != null);
  return unitRents.length ? Math.min(...unitRents) : null;
}

function serializeUnitTypes(
  propertyId: number,
  types: UnitTypeRow[],
  units: UnitRow[],
  images: ImageRow[],
  vacantOnly: boolean,
) {
  const out = [];
  for (const t of types) {
    if (vacantOnly && !t.is_vacant) continue;
    const tImgs = images.filter((i) => i.unit_type_id === t.id);
    const tUnits = units.filter((u) => u.unit_type_id === t.id);
    const rents = tUnits.map((u) => num(u.rent_amount)).filter((n): n is number => n != null);
    const typeRent = num(t.rent_amount);
    const minRent = typeRent != null ? typeRent : rents.length ? Math.min(...rents) : null;
    out.push({
      id: t.id,
      property_id: propertyId,
      category: t.category,
      custom_label: t.custom_label,
      label: displayLabel(t.category, t.custom_label),
      sort_order: t.sort_order,
      rent_amount: typeRent,
      is_vacant: t.is_vacant,
      images: tImgs.map(serializeImage),
      vacant_units: tUnits.filter((u) => u.status === "vacant").length,
      total_units: tUnits.length,
      min_rent: minRent,
      created_at: t.created_at,
    });
  }
  return out;
}

/** Same filters / card rules as FastAPI list_public_listings. */
export async function listPublicListings(params: PublicListParams) {
  const db = getPool();
  const clauses = [`is_published = true`, `COALESCE(is_unused, false) = false`];
  const values: unknown[] = [];
  let i = 1;

  if (params.listing_type) {
    clauses.push(`listing_type = $${i++}`);
    values.push(params.listing_type);
  }
  if (params.county?.trim()) {
    const c = params.county.trim();
    clauses.push(`(county ILIKE $${i} OR location ILIKE $${i + 1})`);
    values.push(c, `%${c}%`);
    i += 2;
  }
  if (params.locality?.trim()) {
    const loc = params.locality.trim();
    clauses.push(`(locality ILIKE $${i} OR location ILIKE $${i + 1})`);
    values.push(loc, `%${loc}%`);
    i += 2;
  } else if (params.location?.trim()) {
    clauses.push(`location ILIKE $${i++}`);
    values.push(`%${params.location.trim()}%`);
  }

  const propsRes = await db.query<PropRow>(
    `SELECT id, name, location, county, locality, listing_type, description, image_url,
            contact_phone, contact_whatsapp, latitude, longitude, cover_image_id, view_count
     FROM properties WHERE ${clauses.join(" AND ")}`,
    values,
  );

  const props = propsRes.rows;
  const { typesByProp, unitsByProp, imagesByProp } = await loadRelated(props.map((p) => p.id));

  const lat = params.lat ?? null;
  const lng = params.lng ?? null;
  const radiusKm = params.radius_km ?? 20;
  const radiusActive = lat != null && lng != null;
  const categoryFilter = params.category?.trim() || null;
  const minPrice = params.min_price ?? null;
  const maxPrice = params.max_price ?? null;

  const results = [];
  for (const prop of props) {
    if (radiusActive) {
      if (prop.latitude == null || prop.longitude == null) continue;
      const dlat = Math.abs(Number(prop.latitude) - lat!);
      const dlng = Math.abs(Number(prop.longitude) - lng!);
      const approxKm = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
      if (approxKm > radiusKm) continue;
    }

    const types = typesByProp.get(prop.id) || [];
    const units = unitsByProp.get(prop.id) || [];
    const images = imagesByProp.get(prop.id) || [];

    let vacantForCard: UnitTypeRow[] = [];
    let minRent: number | null = null;

    if ((prop.listing_type === "rental" || prop.listing_type === "airbnb") && types.length) {
      const vacant = types.filter((t) => t.is_vacant);
      if (!vacant.length) continue;
      if (categoryFilter && !vacant.some((t) => t.category === categoryFilter)) continue;
      vacantForCard = vacant;
      minRent = minRentForTypes(types, units, true);
    } else if (types.length) {
      if (categoryFilter && !types.some((t) => t.category === categoryFilter)) continue;
      vacantForCard = types.filter((t) => t.is_vacant);
      if (!vacantForCard.length) vacantForCard = types;
      minRent = minRentForTypes(types, units, false);
    } else {
      if (categoryFilter) continue;
      const rents = units.map((u) => num(u.rent_amount)).filter((n): n is number => n != null);
      minRent = rents.length ? Math.min(...rents) : null;
    }

    if (minPrice != null && minRent != null && minRent < minPrice) continue;
    if (maxPrice != null && minRent != null && minRent > maxPrice) continue;

    results.push({
      id: prop.id,
      name: prop.name,
      location: prop.location,
      county: prop.county,
      locality: prop.locality,
      listing_type: prop.listing_type,
      description: prop.description,
      image_url: coverUrl(prop, images),
      contact_phone: prop.contact_phone,
      contact_whatsapp: prop.contact_whatsapp,
      contact_email: null,
      latitude: prop.latitude != null ? Number(prop.latitude) : null,
      longitude: prop.longitude != null ? Number(prop.longitude) : null,
      min_rent: minRent,
      vacant_types: vacantForCard.map((t) => ({
        label: displayLabel(t.category, t.custom_label),
        category: t.category,
        rent_amount: num(t.rent_amount),
      })),
    });
  }

  return results;
}

/** Same rules as FastAPI get_public_listing_detail. */
export async function getPublicListingDetail(listingId: number) {
  const db = getPool();
  const propRes = await db.query<PropRow>(
    `SELECT id, name, location, county, locality, listing_type, description, image_url,
            contact_phone, contact_whatsapp, latitude, longitude, cover_image_id, view_count
     FROM properties
     WHERE id = $1 AND is_published = true AND COALESCE(is_unused, false) = false`,
    [listingId],
  );
  const prop = propRes.rows[0];
  if (!prop) return null;

  const { typesByProp, unitsByProp, imagesByProp } = await loadRelated([listingId]);
  const types = typesByProp.get(listingId) || [];
  const units = unitsByProp.get(listingId) || [];
  const images = imagesByProp.get(listingId) || [];

  const hideEmpty = prop.listing_type === "rental" || prop.listing_type === "airbnb";
  if (hideEmpty && types.length && !types.some((t) => t.is_vacant)) {
    return null;
  }

  await db.query(`UPDATE properties SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`, [listingId]);

  const cover = coverUrl(prop, images);
  let imageUrl = cover;
  if ((!imageUrl || imageUrl.length < 20) && images[0]) imageUrl = images[0].url;

  return {
    id: prop.id,
    name: prop.name,
    location: prop.location,
    county: prop.county,
    locality: prop.locality,
    listing_type: prop.listing_type,
    description: prop.description,
    image_url: imageUrl,
    contact_phone: prop.contact_phone,
    contact_whatsapp: prop.contact_whatsapp,
    contact_email: null,
    latitude: prop.latitude != null ? Number(prop.latitude) : null,
    longitude: prop.longitude != null ? Number(prop.longitude) : null,
    min_rent: minRentForTypes(types, units, hideEmpty && types.length > 0),
    vacant_types: (hideEmpty ? types.filter((t) => t.is_vacant) : types).map((t) => ({
      label: displayLabel(t.category, t.custom_label),
      category: t.category,
      rent_amount: num(t.rent_amount),
    })),
    images: images.map(serializeImage),
    unit_types: serializeUnitTypes(listingId, types, units, images, hideEmpty),
    cover_image_id: prop.cover_image_id,
  };
}
