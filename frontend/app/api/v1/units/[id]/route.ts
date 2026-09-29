import { NextRequest } from "next/server";
import { getPool, jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownedUnit(ownerId: number, unitId: number) {
  const db = getPool();
  const r = await db.query(
    `SELECT u.id FROM units u
     JOIN properties p ON p.id = u.property_id
     WHERE u.id = $1 AND p.owner_id = $2 AND COALESCE(u.is_unused,false)=false
       AND COALESCE(p.is_unused,false)=false`,
    [unitId, ownerId],
  );
  return Boolean(r.rows[0]);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const unitId = Number(params.id);
    if (!(await ownedUnit(user.id, unitId))) return jsonError("Unit not found", 404);
    const body = await req.json();
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const key of ["unit_number", "status", "rent_amount", "unit_type_id"] as const) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(body[key]);
      }
    }
    if (!fields.length) return jsonError("Nothing to update", 400);
    values.push(unitId);
    const db = getPool();
    const r = await db.query(
      `UPDATE units SET ${fields.join(", ")} WHERE id = $${i}
       RETURNING id, property_id, unit_number, rent_amount, status, unit_type_id, is_unused, unused_at`,
      values,
    );
    const u = r.rows[0];
    return Response.json({ ...u, rent_amount: Number(u.rent_amount) });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const unitId = Number(params.id);
    if (!(await ownedUnit(user.id, unitId))) return jsonError("Unit not found", 404);
    const db = getPool();
    await db.query(
      `UPDATE units SET is_unused = true, unused_at = NOW() WHERE id = $1`,
      [unitId],
    );
    return Response.json({ message: "Unit removed" });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}
