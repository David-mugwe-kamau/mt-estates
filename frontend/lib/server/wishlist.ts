import { getPool } from "@/lib/server/db";
import type { AuthUser } from "@/lib/server/auth";

type WishlistRow = {
  id: number;
  title: string;
  location_text: string | null;
  listing_type: string;
  notes: string | null;
  external_ref: string | null;
  is_available: boolean | null;
  created_at: string;
};

async function computeAvailability(item: WishlistRow): Promise<boolean | null> {
  if (!item.external_ref || !/^\d+$/.test(item.external_ref)) return item.is_available;
  const propId = Number(item.external_ref);
  const db = getPool();
  const prop = await db.query<{ is_published: boolean; is_unused: boolean }>(
    `SELECT is_published, COALESCE(is_unused, false) AS is_unused FROM properties WHERE id = $1`,
    [propId],
  );
  if (!prop.rows[0]) return false;
  if (prop.rows[0].is_unused) return false;
  if (!prop.rows[0].is_published) return false;
  if (item.listing_type === "rental") {
    const vacant = await db.query(
      `SELECT id FROM units
       WHERE property_id = $1 AND status = 'vacant' AND COALESCE(is_unused, false) = false
       LIMIT 1`,
      [propId],
    );
    return Boolean(vacant.rows[0]);
  }
  return true;
}

export async function listWishlist(userId: number) {
  const db = getPool();
  const r = await db.query<WishlistRow>(
    `SELECT id, title, location_text, listing_type, notes, external_ref, is_available,
            created_at::text AS created_at
     FROM wishlist_items WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  const out = [];
  for (const item of r.rows) {
    out.push({
      ...item,
      is_available: await computeAvailability(item),
    });
  }
  return out;
}

export async function addWishlistItem(
  user: AuthUser,
  data: {
    title: string;
    location_text?: string | null;
    listing_type: string;
    notes?: string | null;
    external_ref?: string | null;
    is_available?: boolean | null;
  },
) {
  const db = getPool();
  if (data.external_ref) {
    const existing = await db.query<WishlistRow>(
      `SELECT id, title, location_text, listing_type, notes, external_ref, is_available,
              created_at::text AS created_at
       FROM wishlist_items WHERE user_id = $1 AND external_ref = $2`,
      [user.id, data.external_ref],
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      return { ...row, is_available: await computeAvailability(row) };
    }
  }

  const ins = await db.query<WishlistRow>(
    `INSERT INTO wishlist_items (user_id, title, location_text, listing_type, notes, external_ref, is_available)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, title, location_text, listing_type, notes, external_ref, is_available,
               created_at::text AS created_at`,
    [
      user.id,
      data.title,
      data.location_text ?? null,
      data.listing_type,
      data.notes ?? null,
      data.external_ref ?? null,
      data.is_available ?? null,
    ],
  );
  const row = ins.rows[0];
  return { ...row, is_available: await computeAvailability(row) };
}

export async function deleteWishlistItem(userId: number, itemId: number) {
  const db = getPool();
  const r = await db.query(`DELETE FROM wishlist_items WHERE id = $1 AND user_id = $2`, [
    itemId,
    userId,
  ]);
  return (r.rowCount || 0) > 0;
}
