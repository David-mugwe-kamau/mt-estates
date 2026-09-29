import { getPool } from "@/lib/server/db";
import type { AuthUser } from "@/lib/server/auth";

type ViewingRow = {
  id: number;
  property_id: number;
  user_id: number;
  preferred_date: string | null;
  message: string | null;
  status: string;
  created_at: string;
  property_name?: string | null;
  property_location?: string | null;
  requester_name?: string | null;
  requester_email?: string | null;
  requester_phone?: string | null;
  listing_type?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
};

export async function createViewing(
  user: AuthUser,
  data: { property_id: number; preferred_date?: string; message?: string },
) {
  const db = getPool();
  const prop = await db.query<{ id: number; owner_id: number }>(
    `SELECT id, owner_id FROM properties
     WHERE id = $1 AND is_published = true AND COALESCE(is_unused, false) = false`,
    [data.property_id],
  );
  if (!prop.rows[0]) throw new Error("Property not found or not published");
  if (prop.rows[0].owner_id === user.id) {
    throw new Error("You cannot book a viewing for your own listing");
  }

  const preferred =
    data.preferred_date && String(data.preferred_date).trim()
      ? String(data.preferred_date).trim()
      : null;
  const message = data.message ? String(data.message).slice(0, 1000) : null;

  const ins = await db.query<ViewingRow>(
    `INSERT INTO viewing_requests (property_id, user_id, preferred_date, message, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id, property_id, user_id, preferred_date::text, message, status, created_at::text AS created_at`,
    [data.property_id, user.id, preferred, message],
  );
  return ins.rows[0];
}

export async function listMyViewings(userId: number) {
  const db = getPool();
  const r = await db.query<ViewingRow>(
    `SELECT v.id, v.property_id, v.user_id, v.preferred_date::text, v.message, v.status,
            v.created_at::text AS created_at,
            p.name AS property_name, p.location AS property_location,
            p.listing_type, p.contact_phone, p.contact_whatsapp
     FROM viewing_requests v
     JOIN properties p ON p.id = v.property_id
     WHERE v.user_id = $1
     ORDER BY v.created_at DESC`,
    [userId],
  );
  return r.rows;
}

export async function listReceivedViewings(ownerId: number) {
  const db = getPool();
  const r = await db.query<ViewingRow>(
    `SELECT v.id, v.property_id, v.user_id, v.preferred_date::text, v.message, v.status,
            v.created_at::text AS created_at,
            p.name AS property_name, p.location AS property_location,
            p.listing_type, p.contact_phone, p.contact_whatsapp,
            u.name AS requester_name, u.email AS requester_email, u.phone AS requester_phone
     FROM viewing_requests v
     JOIN properties p ON p.id = v.property_id
     JOIN users u ON u.id = v.user_id
     WHERE p.owner_id = $1
     ORDER BY v.created_at DESC`,
    [ownerId],
  );
  return r.rows;
}

export async function updateViewingStatus(ownerId: number, viewingId: number, status: string) {
  if (!["pending", "confirmed", "declined"].includes(status)) {
    throw new Error("Invalid status");
  }
  const db = getPool();
  const r = await db.query<ViewingRow>(
    `UPDATE viewing_requests v
     SET status = $1
     FROM properties p
     WHERE v.id = $2 AND v.property_id = p.id AND p.owner_id = $3
     RETURNING v.id, v.property_id, v.user_id, v.preferred_date::text, v.message, v.status,
               v.created_at::text AS created_at`,
    [status, viewingId, ownerId],
  );
  return r.rows[0] || null;
}
