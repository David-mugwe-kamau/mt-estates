import { getPool, jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser, type AuthUser } from "@/lib/server/auth";
import { UNIT_CATEGORIES } from "@/lib/apartmentTypes";
import { ensureExtraChargeColumns, parseExtraCharges } from "@/lib/server/extraCharges";

const FREE_GALLERY_LIMIT = 6;
const LABEL_MAP = Object.fromEntries(UNIT_CATEGORIES.map((c) => [c.id, c.label]));

function displayLabel(category: string, customLabel: string | null) {
  if (category === "other" && customLabel?.trim()) return customLabel.trim();
  return LABEL_MAP[category] || category;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type PropRow = {
  id: number;
  owner_id: number;
  name: string;
  location: string;
  county: string | null;
  locality: string | null;
  listing_type: string | null;
  is_published: boolean;
  description: string | null;
  image_url: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
  latitude: number | null;
  longitude: number | null;
  water_rate_per_unit: unknown;
  garbage_fee: unknown;
  extra_charges?: unknown;
  main_meter_reading: unknown;
  view_count: number;
  cover_image_id: number | null;
  created_at: string;
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

type TypeRow = {
  id: number;
  property_id: number;
  category: string;
  custom_label: string | null;
  rent_amount: unknown;
  is_vacant: boolean;
  sort_order: number;
  created_at: string;
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

function propBase(p: PropRow) {
  return {
    id: p.id,
    owner_id: p.owner_id,
    name: p.name,
    location: p.location,
    county: p.county,
    locality: p.locality,
    listing_type: p.listing_type,
    is_published: p.is_published,
    description: p.description,
    image_url: p.image_url,
    contact_phone: p.contact_phone,
    contact_whatsapp: p.contact_whatsapp,
    contact_email: p.contact_email,
    latitude: p.latitude != null ? Number(p.latitude) : null,
    longitude: p.longitude != null ? Number(p.longitude) : null,
    water_rate_per_unit: num(p.water_rate_per_unit),
    garbage_fee: num(p.garbage_fee),
    extra_charges: parseExtraCharges(p.extra_charges),
    main_meter_reading: num(p.main_meter_reading),
    view_count: p.view_count ?? 0,
    cover_image_id: p.cover_image_id,
    created_at: p.created_at,
  };
}

async function ownedProperty(propertyId: number, ownerId: number) {
  const db = getPool();
  const r = await db.query<PropRow>(
    `SELECT id, owner_id, name, location, county, locality, listing_type, is_published,
            description, image_url, contact_phone, contact_whatsapp, contact_email,
            latitude, longitude, water_rate_per_unit, garbage_fee, extra_charges, main_meter_reading,
            view_count, cover_image_id, created_at::text AS created_at
     FROM properties
     WHERE id = $1 AND owner_id = $2 AND COALESCE(is_unused, false) = false`,
    [propertyId, ownerId],
  );
  return r.rows[0] || null;
}

async function loadImages(propertyId: number) {
  const db = getPool();
  const r = await db.query<ImageRow>(
    `SELECT id, property_id, url, sort_order, is_cover, unit_type_id, is_unused, unused_at, created_at::text AS created_at
     FROM property_images
     WHERE property_id = $1 AND COALESCE(is_unused, false) = false
     ORDER BY sort_order, id`,
    [propertyId],
  );
  return r.rows;
}

async function loadTypes(propertyId: number) {
  const db = getPool();
  const r = await db.query<TypeRow>(
    `SELECT id, property_id, category, custom_label, rent_amount, is_vacant, sort_order, created_at::text AS created_at
     FROM unit_types WHERE property_id = $1 ORDER BY sort_order, id`,
    [propertyId],
  );
  return r.rows;
}

async function serializeUnitTypes(propertyId: number, vacantOnly = false) {
  const db = getPool();
  const types = await loadTypes(propertyId);
  const images = await loadImages(propertyId);
  const units = await db.query<{ id: number; unit_type_id: number | null; rent_amount: unknown; status: string }>(
    `SELECT id, unit_type_id, rent_amount, status FROM units
     WHERE property_id = $1 AND COALESCE(is_unused, false) = false`,
    [propertyId],
  );
  const out = [];
  for (const t of types) {
    if (vacantOnly && !t.is_vacant) continue;
    const tImgs = images.filter((i) => i.unit_type_id === t.id);
    const tUnits = units.rows.filter((u) => u.unit_type_id === t.id);
    const rents = tUnits.map((u) => num(u.rent_amount)).filter((n): n is number => n != null);
    const typeRent = num(t.rent_amount);
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
      min_rent: typeRent != null ? typeRent : rents.length ? Math.min(...rents) : null,
      created_at: t.created_at,
    });
  }
  return out;
}

function pickCoverUrl(prop: PropRow, images: ImageRow[]): string | null {
  if (prop.cover_image_id) {
    const c = images.find((i) => i.id === prop.cover_image_id);
    if (c) return c.url;
  }
  const typedCover = images.find((i) => i.unit_type_id && i.is_cover);
  if (typedCover) return typedCover.url;
  const typed = images.find((i) => i.unit_type_id);
  if (typed) return typed.url;
  const cover = images.find((i) => i.is_cover) || images[0];
  if (cover) return cover.url;
  if (prop.image_url && prop.image_url.length >= 32) return prop.image_url;
  return null;
}

export async function listOwnerProperties(user: AuthUser) {
  await ensureExtraChargeColumns();
  const db = getPool();
  const r = await db.query<PropRow>(
    `SELECT id, owner_id, name, location, county, locality, listing_type, is_published,
            description, image_url, contact_phone, contact_whatsapp, contact_email,
            latitude, longitude, water_rate_per_unit, garbage_fee, extra_charges, main_meter_reading,
            view_count, cover_image_id, created_at::text AS created_at
     FROM properties
     WHERE owner_id = $1 AND COALESCE(is_unused, false) = false
     ORDER BY id DESC`,
    [user.id],
  );
  const results = [];
  for (const prop of r.rows) {
    const images = await loadImages(prop.id);
    const types = await loadTypes(prop.id);
    const vacant = types.filter((t) => t.is_vacant);
    const item = propBase(prop);
    item.image_url = pickCoverUrl(prop, images);
    results.push({
      ...item,
      type_count: types.length,
      has_vacant_type: types.length ? vacant.length > 0 : null,
      vacant_type_labels: vacant.map((t) => displayLabel(t.category, t.custom_label)),
    });
  }
  return results;
}

export async function getOwnerProperty(user: AuthUser, propertyId: number) {
  await ensureExtraChargeColumns();
  const prop = await ownedProperty(propertyId, user.id);
  if (!prop) return null;
  const images = await loadImages(propertyId);
  const item = propBase(prop);
  item.image_url = pickCoverUrl(prop, images);
  return {
    ...item,
    images: images.map(serializeImage),
    unit_types: await serializeUnitTypes(propertyId),
  };
}

export async function createOwnerProperty(user: AuthUser, body: Record<string, unknown>) {
  await ensureExtraChargeColumns();
  const db = getPool();
  const r = await db.query<PropRow>(
    `INSERT INTO properties (
       owner_id, name, location, county, locality, listing_type, description,
       contact_phone, contact_whatsapp, contact_email, latitude, longitude,
       water_rate_per_unit, garbage_fee, is_unused
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
       COALESCE($13, 150), COALESCE($14, 200), false
     )
     RETURNING id, owner_id, name, location, county, locality, listing_type, is_published,
               description, image_url, contact_phone, contact_whatsapp, contact_email,
               latitude, longitude, water_rate_per_unit, garbage_fee, extra_charges, main_meter_reading,
               view_count, cover_image_id, created_at::text AS created_at`,
    [
      user.id,
      String(body.name || "").trim(),
      String(body.location || "").trim(),
      body.county ? String(body.county) : null,
      body.locality ? String(body.locality) : null,
      body.listing_type ? String(body.listing_type) : null,
      body.description ? String(body.description) : null,
      body.contact_phone ? String(body.contact_phone) : null,
      body.contact_whatsapp ? String(body.contact_whatsapp) : null,
      body.contact_email ? String(body.contact_email) : null,
      body.latitude != null ? Number(body.latitude) : null,
      body.longitude != null ? Number(body.longitude) : null,
      body.water_rate_per_unit != null ? Number(body.water_rate_per_unit) : null,
      body.garbage_fee != null ? Number(body.garbage_fee) : null,
    ],
  );
  return propBase(r.rows[0]);
}

async function assertCanPublish(prop: PropRow, patch: Record<string, unknown>) {
  const phone =
    ("contact_phone" in patch ? patch.contact_phone : prop.contact_phone) || "";
  const wa =
    ("contact_whatsapp" in patch ? patch.contact_whatsapp : prop.contact_whatsapp) || "";
  if (!String(phone).trim() && !String(wa).trim()) {
    throw new Error("Add a viewing phone or WhatsApp number before publishing.");
  }
  if (prop.listing_type === "rental" || prop.listing_type === "airbnb") {
    const types = await loadTypes(prop.id);
    if (!types.length) throw new Error("Add at least one apartment type before publishing.");
    const images = await loadImages(prop.id);
    let ready = false;
    for (const t of types) {
      if (!t.is_vacant) continue;
      if (num(t.rent_amount) == null) continue;
      if (images.some((i) => i.unit_type_id === t.id)) {
        ready = true;
        break;
      }
    }
    if (!ready) {
      throw new Error("Before publishing, add a vacant type with rent and at least one photo.");
    }
  }
}

export async function updateOwnerProperty(
  user: AuthUser,
  propertyId: number,
  body: Record<string, unknown>,
) {
  await ensureExtraChargeColumns();
  const prop = await ownedProperty(propertyId, user.id);
  if (!prop) return null;
  if (body.is_published === true) await assertCanPublish(prop, body);

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const allowed = [
    "name",
    "location",
    "county",
    "locality",
    "listing_type",
    "description",
    "contact_phone",
    "contact_whatsapp",
    "contact_email",
    "latitude",
    "longitude",
    "water_rate_per_unit",
    "garbage_fee",
    "extra_charges",
    "main_meter_reading",
    "is_published",
    "image_url",
  ] as const;
  for (const key of allowed) {
    if (key in body && body[key] !== undefined) {
      fields.push(`${key} = $${i++}`);
      values.push(key === "extra_charges" ? JSON.stringify(parseExtraCharges(body[key])) : body[key]);
    }
  }
  if (!fields.length) return propBase(prop);
  values.push(propertyId, user.id);
  const db = getPool();
  const r = await db.query<PropRow>(
    `UPDATE properties SET ${fields.join(", ")}
     WHERE id = $${i++} AND owner_id = $${i}
       AND COALESCE(is_unused, false) = false
     RETURNING id, owner_id, name, location, county, locality, listing_type, is_published,
               description, image_url, contact_phone, contact_whatsapp, contact_email,
               latitude, longitude, water_rate_per_unit, garbage_fee, extra_charges, main_meter_reading,
               view_count, cover_image_id, created_at::text AS created_at`,
    values,
  );
  return r.rows[0] ? propBase(r.rows[0]) : null;
}

export async function softDeleteOwnerProperty(user: AuthUser, propertyId: number) {
  const db = getPool();
  const r = await db.query(
    `UPDATE properties SET is_unused = true, unused_at = NOW(), is_published = false
     WHERE id = $1 AND owner_id = $2 AND COALESCE(is_unused, false) = false`,
    [propertyId, user.id],
  );
  return (r.rowCount || 0) > 0;
}

export async function addImage(
  user: AuthUser,
  propertyId: number,
  body: { url: string; is_cover?: boolean; unit_type_id?: number | null },
) {
  const prop = await ownedProperty(propertyId, user.id);
  if (!prop) return null;
  const db = getPool();
  const unitTypeId = body.unit_type_id ?? null;
  if (unitTypeId) {
    const ut = await db.query(`SELECT id FROM unit_types WHERE id = $1 AND property_id = $2`, [
      unitTypeId,
      propertyId,
    ]);
    if (!ut.rows[0]) throw new Error("Apartment type not found on this listing");
  }
  const countQ =
    unitTypeId == null
      ? await db.query(
          `SELECT COUNT(*)::int AS n FROM property_images
           WHERE property_id = $1 AND unit_type_id IS NULL AND COALESCE(is_unused,false)=false`,
          [propertyId],
        )
      : await db.query(
          `SELECT COUNT(*)::int AS n FROM property_images
           WHERE property_id = $1 AND unit_type_id = $2 AND COALESCE(is_unused,false)=false`,
          [propertyId, unitTypeId],
        );
  const count = countQ.rows[0].n as number;
  const scope = unitTypeId ? "this apartment type" : "the listing";
  if (count >= FREE_GALLERY_LIMIT) {
    throw new Error(`Free gallery limit is ${FREE_GALLERY_LIMIT} photos for ${scope}`);
  }

  const ins = await db.query<ImageRow>(
    `INSERT INTO property_images (property_id, url, sort_order, is_cover, is_unused, unit_type_id)
     VALUES ($1, $2, $3, false, false, $4)
     RETURNING id, property_id, url, sort_order, is_cover, unit_type_id, is_unused, unused_at, created_at::text AS created_at`,
    [propertyId, body.url, count, unitTypeId],
  );
  let image = ins.rows[0];
  if (body.is_cover || count === 0) {
    if (unitTypeId == null) {
      await db.query(
        `UPDATE property_images SET is_cover = false
         WHERE property_id = $1 AND unit_type_id IS NULL AND COALESCE(is_unused,false)=false`,
        [propertyId],
      );
    } else {
      await db.query(
        `UPDATE property_images SET is_cover = false
         WHERE property_id = $1 AND unit_type_id = $2 AND COALESCE(is_unused,false)=false`,
        [propertyId, unitTypeId],
      );
    }
    await db.query(`UPDATE property_images SET is_cover = true WHERE id = $1`, [image.id]);
    if (unitTypeId == null) {
      const short = body.url.length <= 500 ? body.url : null;
      await db.query(`UPDATE properties SET image_url = $1 WHERE id = $2`, [short, propertyId]);
    }
    if (prop.cover_image_id == null) {
      await db.query(`UPDATE properties SET cover_image_id = $1 WHERE id = $2`, [image.id, propertyId]);
    }
    image = { ...image, is_cover: true };
  }
  return serializeImage(image);
}

export async function setCover(user: AuthUser, propertyId: number, imageId: number) {
  const prop = await ownedProperty(propertyId, user.id);
  if (!prop) return null;
  const db = getPool();
  const img = await db.query<ImageRow>(
    `SELECT id, property_id, url, sort_order, is_cover, unit_type_id, is_unused, unused_at, created_at::text AS created_at
     FROM property_images WHERE id = $1 AND property_id = $2 AND COALESCE(is_unused,false)=false`,
    [imageId, propertyId],
  );
  const image = img.rows[0];
  if (!image) return null;
  if (image.unit_type_id == null) {
    await db.query(
      `UPDATE property_images SET is_cover = false
       WHERE property_id = $1 AND unit_type_id IS NULL AND COALESCE(is_unused,false)=false`,
      [propertyId],
    );
  } else {
    await db.query(
      `UPDATE property_images SET is_cover = false
       WHERE property_id = $1 AND unit_type_id = $2 AND COALESCE(is_unused,false)=false`,
      [propertyId, image.unit_type_id],
    );
  }
  await db.query(`UPDATE property_images SET is_cover = true WHERE id = $1`, [imageId]);
  return serializeImage({ ...image, is_cover: true });
}

export async function removeImage(user: AuthUser, propertyId: number, imageId: number) {
  const prop = await ownedProperty(propertyId, user.id);
  if (!prop) return false;
  const db = getPool();
  const r = await db.query(
    `UPDATE property_images SET is_unused = true, unused_at = NOW(), is_cover = false
     WHERE id = $1 AND property_id = $2 AND COALESCE(is_unused,false)=false`,
    [imageId, propertyId],
  );
  return (r.rowCount || 0) > 0;
}

export async function setListingCover(user: AuthUser, propertyId: number, imageId: number) {
  const prop = await ownedProperty(propertyId, user.id);
  if (!prop) throw new Error("Property not found");
  const db = getPool();
  const img = await db.query(
    `SELECT id FROM property_images WHERE id = $1 AND property_id = $2 AND COALESCE(is_unused,false)=false`,
    [imageId, propertyId],
  );
  if (!img.rows[0]) throw new Error("Photo not found on this listing");
  const r = await db.query<PropRow>(
    `UPDATE properties SET cover_image_id = $1 WHERE id = $2
     RETURNING id, owner_id, name, location, county, locality, listing_type, is_published,
               description, image_url, contact_phone, contact_whatsapp, contact_email,
               latitude, longitude, water_rate_per_unit, garbage_fee, extra_charges, main_meter_reading,
               view_count, cover_image_id, created_at::text AS created_at`,
    [imageId, propertyId],
  );
  return propBase(r.rows[0]);
}

export async function addUnitType(
  user: AuthUser,
  propertyId: number,
  body: { category: string; custom_label?: string; rent_amount?: number },
) {
  const prop = await ownedProperty(propertyId, user.id);
  if (!prop) throw new Error("Property not found");
  const category = body.category;
  if (!UNIT_CATEGORIES.some((c) => c.id === category)) throw new Error("Unknown apartment type");
  if (category === "other" && !(body.custom_label || "").trim()) {
    throw new Error("Type a name for Other");
  }
  const db = getPool();
  if (category !== "other") {
    const ex = await db.query(`SELECT id FROM unit_types WHERE property_id = $1 AND category = $2`, [
      propertyId,
      category,
    ]);
    if (ex.rows[0]) throw new Error("This apartment type is already on the listing");
  }
  const count = await db.query(`SELECT COUNT(*)::int AS n FROM unit_types WHERE property_id = $1`, [
    propertyId,
  ]);
  await db.query(
    `INSERT INTO unit_types (property_id, category, custom_label, rent_amount, is_vacant, sort_order)
     VALUES ($1,$2,$3,$4,true,$5)`,
    [
      propertyId,
      category,
      (body.custom_label || "").trim() || null,
      body.rent_amount != null ? body.rent_amount : null,
      count.rows[0].n,
    ],
  );
  return serializeUnitTypes(propertyId);
}

export async function updateUnitType(
  user: AuthUser,
  propertyId: number,
  typeId: number,
  body: { rent_amount?: number; is_vacant?: boolean; category?: string; custom_label?: string },
) {
  const prop = await ownedProperty(propertyId, user.id);
  if (!prop) return null;
  const db = getPool();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (body.category !== undefined) {
    if (!UNIT_CATEGORIES.some((c) => c.id === body.category)) throw new Error("Unknown apartment type");
    fields.push(`category = $${i++}`);
    values.push(body.category);
  }
  if (body.custom_label !== undefined) {
    fields.push(`custom_label = $${i++}`);
    values.push(body.custom_label.trim() || null);
  }
  if (body.rent_amount !== undefined) {
    fields.push(`rent_amount = $${i++}`);
    values.push(body.rent_amount);
  }
  if (body.is_vacant !== undefined) {
    fields.push(`is_vacant = $${i++}`);
    values.push(body.is_vacant);
  }
  if (!fields.length) return serializeUnitTypes(propertyId);
  values.push(typeId, propertyId);
  const r = await db.query(
    `UPDATE unit_types SET ${fields.join(", ")}
     WHERE id = $${i++} AND property_id = $${i}`,
    values,
  );
  if (!(r.rowCount || 0)) return null;
  return serializeUnitTypes(propertyId);
}

export async function removeUnitType(user: AuthUser, propertyId: number, typeId: number) {
  const prop = await ownedProperty(propertyId, user.id);
  if (!prop) return false;
  const db = getPool();
  const live = await db.query(
    `SELECT COUNT(*)::int AS n FROM units WHERE unit_type_id = $1 AND COALESCE(is_unused,false)=false`,
    [typeId],
  );
  if (live.rows[0].n > 0) throw new Error("Move or remove units of this type first");
  await db.query(
    `UPDATE property_images SET unit_type_id = NULL, is_unused = true, unused_at = NOW()
     WHERE unit_type_id = $1 AND COALESCE(is_unused,false)=false`,
    [typeId],
  );
  const r = await db.query(`DELETE FROM unit_types WHERE id = $1 AND property_id = $2`, [
    typeId,
    propertyId,
  ]);
  return (r.rowCount || 0) > 0;
}

export { requireUser, isAuthUser, jsonError, serializeUnitTypes };
