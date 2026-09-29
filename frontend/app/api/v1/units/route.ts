import { NextRequest } from "next/server";
import { getPool, jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnsProperty(ownerId: number, propertyId: number) {
  const db = getPool();
  const r = await db.query(
    `SELECT id FROM properties WHERE id = $1 AND owner_id = $2 AND COALESCE(is_unused,false)=false`,
    [propertyId, ownerId],
  );
  return Boolean(r.rows[0]);
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const propertyId = req.nextUrl.searchParams.get("property_id");
    const db = getPool();
    if (propertyId) {
      if (!(await assertOwnsProperty(user.id, Number(propertyId)))) {
        return jsonError("Property not found", 404);
      }
      const r = await db.query(
        `SELECT id, property_id, unit_number, rent_amount, status, unit_type_id, is_unused, unused_at
         FROM units WHERE property_id = $1 AND COALESCE(is_unused,false)=false ORDER BY id`,
        [Number(propertyId)],
      );
      return Response.json(
        r.rows.map((u) => ({
          ...u,
          rent_amount: Number(u.rent_amount),
        })),
      );
    }
    const r = await db.query(
      `SELECT u.id, u.property_id, u.unit_number, u.rent_amount, u.status, u.unit_type_id, u.is_unused, u.unused_at
       FROM units u
       JOIN properties p ON p.id = u.property_id
       WHERE p.owner_id = $1 AND COALESCE(u.is_unused,false)=false AND COALESCE(p.is_unused,false)=false
       ORDER BY u.id`,
      [user.id],
    );
    return Response.json(r.rows.map((u) => ({ ...u, rent_amount: Number(u.rent_amount) })));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    const propertyId = Number(body.property_id);
    if (!(await assertOwnsProperty(user.id, propertyId))) return jsonError("Property not found", 404);
    const db = getPool();
    const r = await db.query(
      `INSERT INTO units (property_id, unit_number, rent_amount, status, unit_type_id, is_unused)
       VALUES ($1,$2,$3,COALESCE($4,'vacant'),$5,false)
       RETURNING id, property_id, unit_number, rent_amount, status, unit_type_id, is_unused, unused_at`,
      [
        propertyId,
        String(body.unit_number || ""),
        Number(body.rent_amount || 0),
        body.status || "vacant",
        body.unit_type_id ?? null,
      ],
    );
    const u = r.rows[0];
    return Response.json({ ...u, rent_amount: Number(u.rent_amount) }, { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
