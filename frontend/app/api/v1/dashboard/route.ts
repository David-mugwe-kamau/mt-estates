import { NextRequest } from "next/server";
import { getPool, jsonError } from "@/lib/server/db";
import { isAuthUser, requireUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const db = getPool();
    const props = await db.query(
      `SELECT COUNT(*)::int AS n FROM properties WHERE owner_id = $1 AND COALESCE(is_unused,false)=false`,
      [user.id],
    );
    const units = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'occupied')::int AS occupied,
         COUNT(*) FILTER (WHERE status = 'vacant')::int AS vacant
       FROM units u
       JOIN properties p ON p.id = u.property_id
       WHERE p.owner_id = $1 AND COALESCE(u.is_unused,false)=false AND COALESCE(p.is_unused,false)=false`,
      [user.id],
    );
    return Response.json({
      total_properties: props.rows[0].n,
      total_units: units.rows[0].total,
      occupied_units: units.rows[0].occupied,
      vacant_units: units.rows[0].vacant,
      rent_collected: 0,
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}
