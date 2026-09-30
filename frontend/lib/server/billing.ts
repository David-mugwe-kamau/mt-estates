import { getPool } from "@/lib/server/db";
import type { AuthUser } from "@/lib/server/auth";

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function prevPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function normalizePeriod(period: string): string {
  const p = decodeURIComponent(String(period || "")).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(p)) {
    throw new Error("Invalid billing month");
  }
  return p;
}

function totals(lines: Array<Record<string, unknown>>) {
  const keys = [
    "water_units",
    "water_cost",
    "garbage_fee",
    "rent_amount",
    "total_due",
    "arrears",
    "amount_paid",
    "balance",
  ] as const;
  const t: Record<string, number> = {};
  for (const k of keys) t[k] = lines.reduce((s, line) => s + n(line[k]), 0);
  return t;
}

function openingArrears(
  occupancy: "occupied" | "vacant",
  last: { balance?: unknown; rent_amount?: unknown; garbage_fee?: unknown } | undefined,
): number {
  if (!last) return 0;
  const balance = n(last.balance);
  if (occupancy === "vacant") return balance;
  const lastWasVacant = n(last.rent_amount) === 0 && n(last.garbage_fee) === 0;
  if (lastWasVacant) return 0;
  return balance;
}

async function ownedProperty(propertyId: number, ownerId: number) {
  const db = getPool();
  const r = await db.query<{
    id: number;
    water_rate_per_unit: unknown;
    garbage_fee: unknown;
    main_meter_reading: unknown;
  }>(
    `SELECT id, water_rate_per_unit, garbage_fee, main_meter_reading
     FROM properties
     WHERE id = $1 AND owner_id = $2 AND COALESCE(is_unused, false) = false`,
    [propertyId, ownerId],
  );
  return r.rows[0] || null;
}

function lineFromReading(
  r: Record<string, unknown>,
  unitNumber: string,
  tenant: { id: number; name: string; phone: string | null } | null,
  occupancy: "occupied" | "vacant",
) {
  const previous = n(r.previous_reading);
  const current = n(r.current_reading);
  const waterUnits = n(r.water_units);
  const waterCost = n(r.water_cost);
  const garbage = occupancy === "occupied" ? n(r.garbage_fee) : 0;
  const rent = occupancy === "occupied" ? n(r.rent_amount) : 0;
  const arrears = n(r.arrears);
  const amountPaid = n(r.amount_paid);
  const totalDue = occupancy === "occupied" ? n(r.total_due) : waterCost;
  return {
    id: r.id as number,
    unit_id: r.unit_id as number,
    unit_number: unitNumber,
    occupancy,
    tenant_id: tenant?.id ?? null,
    tenant_name: tenant?.name ?? null,
    tenant_phone: tenant?.phone ?? null,
    period: String(r.period),
    previous_reading: previous,
    current_reading: current,
    water_units: waterUnits,
    water_cost: waterCost,
    garbage_fee: garbage,
    rent_amount: rent,
    total_due: totalDue,
    arrears,
    amount_paid: amountPaid,
    balance: arrears + totalDue - amountPaid,
  };
}

export async function getStatement(user: AuthUser, propertyId: number, period: string) {
  period = normalizePeriod(period);
  const prop = await ownedProperty(propertyId, user.id);
  if (!prop) return null;
  const db = getPool();
  const waterRate = prop.water_rate_per_unit != null ? n(prop.water_rate_per_unit) : 150;
  const garbage = prop.garbage_fee != null ? n(prop.garbage_fee) : 200;
  const prev = prevPeriod(period);

  const units = await db.query<{ id: number; unit_number: string; rent_amount: unknown; status: string }>(
    `SELECT id, unit_number, rent_amount, status FROM units
     WHERE property_id = $1 AND COALESCE(is_unused, false) = false
     ORDER BY unit_number`,
    [propertyId],
  );
  const unitIds = units.rows.map((u) => u.id);

  const tenantsByUnit = new Map<number, { id: number; name: string; phone: string | null }>();
  const currentByUnit = new Map<number, Record<string, unknown>>();
  const prevByUnit = new Map<number, Record<string, unknown>>();

  if (unitIds.length) {
    try {
      const tenants = await db.query<{ id: number; name: string; phone: string | null; unit_id: number }>(
        `SELECT id, name, phone, unit_id FROM tenants WHERE unit_id = ANY($1::int[])`,
        [unitIds],
      );
      for (const t of tenants.rows) tenantsByUnit.set(t.unit_id, t);
    } catch {
      // tenants table optional / empty
    }

    const readings = await db.query(
      `SELECT * FROM meter_readings
       WHERE unit_id = ANY($1::int[]) AND (period = $2 OR period = $3)`,
      [unitIds, period, prev],
    );
    for (const row of readings.rows) {
      const p = String(row.period || "").slice(0, 7);
      if (p === period) currentByUnit.set(row.unit_id, row);
      if (p === prev) prevByUnit.set(row.unit_id, row);
    }
  }

  const lines = [];
  for (const unit of units.rows) {
    const occupancy = unit.status === "occupied" ? "occupied" : "vacant";
    const tenant = tenantsByUnit.get(unit.id) || null;
    const existing = currentByUnit.get(unit.id);
    if (existing) {
      lines.push(lineFromReading(existing, unit.unit_number, tenant, occupancy));
      continue;
    }

    const last = prevByUnit.get(unit.id);
    const previous = last ? n(last.current_reading) : 0;
    const arrears = openingArrears(occupancy, last);
    const rent = occupancy === "occupied" ? n(unit.rent_amount) : 0;
    const garbageFee = occupancy === "occupied" ? garbage : 0;
    const totalDue = garbageFee + rent;
    lines.push({
      id: null,
      unit_id: unit.id,
      unit_number: unit.unit_number,
      occupancy,
      tenant_id: tenant?.id ?? null,
      tenant_name: tenant?.name ?? null,
      tenant_phone: tenant?.phone ?? null,
      period,
      previous_reading: previous,
      current_reading: previous,
      water_units: 0,
      water_cost: 0,
      garbage_fee: garbageFee,
      rent_amount: rent,
      total_due: totalDue,
      arrears,
      amount_paid: 0,
      balance: arrears + totalDue,
    });
  }

  return {
    property_id: propertyId,
    period,
    water_rate_per_unit: waterRate,
    garbage_fee: garbage,
    main_meter_reading: prop.main_meter_reading != null ? n(prop.main_meter_reading) : null,
    lines,
    totals: totals(lines),
  };
}

export async function listPeriods(user: AuthUser, propertyId: number) {
  const prop = await ownedProperty(propertyId, user.id);
  if (!prop) return null;
  const db = getPool();
  const r = await db.query<{ period: string }>(
    `SELECT DISTINCT mr.period
     FROM meter_readings mr
     JOIN units u ON u.id = mr.unit_id
     WHERE u.property_id = $1
     ORDER BY mr.period DESC`,
    [propertyId],
  );
  return r.rows.map((x) => x.period);
}

export async function upsertReadings(
  user: AuthUser,
  propertyId: number,
  period: string,
  data: {
    readings: Array<{
      unit_id: number;
      previous_reading?: number;
      current_reading: number;
      amount_paid?: number;
    }>;
    main_meter_reading?: number;
  },
) {
  period = normalizePeriod(period);
  const prop = await ownedProperty(propertyId, user.id);
  if (!prop) return null;
  const db = getPool();
  const waterRate = prop.water_rate_per_unit != null ? n(prop.water_rate_per_unit) : 150;
  const garbageDefault = prop.garbage_fee != null ? n(prop.garbage_fee) : 200;
  const prev = prevPeriod(period);

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (data.main_meter_reading !== undefined) {
      await client.query(`UPDATE properties SET main_meter_reading = $1 WHERE id = $2`, [
        data.main_meter_reading,
        propertyId,
      ]);
    }

    for (const item of data.readings) {
      const unit = await client.query<{
        id: number;
        unit_number: string;
        rent_amount: unknown;
        status: string;
      }>(
        `SELECT id, unit_number, rent_amount, status FROM units
         WHERE id = $1 AND property_id = $2 AND COALESCE(is_unused, false) = false`,
        [item.unit_id, propertyId],
      );
      if (!unit.rows[0]) throw new Error(`Unit ${item.unit_id} not found on this property`);
      const occupied = unit.rows[0].status === "occupied";

      const last = await client.query(
        `SELECT current_reading, balance, rent_amount, garbage_fee
         FROM meter_readings WHERE unit_id = $1 AND period = $2`,
        [unit.rows[0].id, prev],
      );
      const previous =
        item.previous_reading != null
          ? n(item.previous_reading)
          : last.rows[0]
            ? n(last.rows[0].current_reading)
            : 0;
      const current = n(item.current_reading);
      if (current < previous) {
        throw new Error(`Current reading for ${unit.rows[0].unit_number} cannot be less than previous`);
      }

      const waterUnits = current - previous;
      const waterCost = waterUnits * waterRate;
      const garbage = occupied ? garbageDefault : 0;
      const rent = occupied ? n(unit.rows[0].rent_amount) : 0;
      const totalDue = waterCost + garbage + rent;
      const arrears = openingArrears(occupied ? "occupied" : "vacant", last.rows[0]);

      const existing = await client.query(
        `SELECT id, amount_paid FROM meter_readings WHERE unit_id = $1 AND period = $2`,
        [unit.rows[0].id, period],
      );

      let amountPaid =
        item.amount_paid != null
          ? n(item.amount_paid)
          : existing.rows[0]
            ? n(existing.rows[0].amount_paid)
            : 0;
      if (existing.rows[0] && item.amount_paid == null) {
        amountPaid = n(existing.rows[0].amount_paid);
      }
      const balance = arrears + totalDue - amountPaid;

      await client.query(
        `INSERT INTO meter_readings (
           unit_id, period, previous_reading, current_reading, water_units, water_cost,
           garbage_fee, rent_amount, total_due, arrears, amount_paid, balance
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (unit_id, period) DO UPDATE SET
           previous_reading = EXCLUDED.previous_reading,
           current_reading = EXCLUDED.current_reading,
           water_units = EXCLUDED.water_units,
           water_cost = EXCLUDED.water_cost,
           garbage_fee = EXCLUDED.garbage_fee,
           rent_amount = EXCLUDED.rent_amount,
           total_due = EXCLUDED.total_due,
           arrears = EXCLUDED.arrears,
           amount_paid = EXCLUDED.amount_paid,
           balance = EXCLUDED.balance`,
        [
          unit.rows[0].id,
          period,
          previous,
          current,
          waterUnits,
          waterCost,
          garbage,
          rent,
          totalDue,
          arrears,
          amountPaid,
          balance,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return getStatement(user, propertyId, period);
}

export async function recordPayment(user: AuthUser, readingId: number, amountPaid: number) {
  const db = getPool();
  const r = await db.query(
    `UPDATE meter_readings mr
     SET amount_paid = $1,
         balance = COALESCE(mr.arrears, 0) + COALESCE(mr.total_due, 0) - $1
     FROM units u
     JOIN properties p ON p.id = u.property_id
     WHERE mr.id = $2 AND mr.unit_id = u.id AND p.owner_id = $3
     RETURNING mr.id, mr.amount_paid, mr.balance, mr.total_due`,
    [amountPaid, readingId, user.id],
  );
  if (!r.rows[0]) return null;
  return {
    id: r.rows[0].id,
    amount_paid: n(r.rows[0].amount_paid),
    balance: n(r.rows[0].balance),
    total_due: n(r.rows[0].total_due),
  };
}
