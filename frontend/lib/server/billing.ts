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
) {
  return {
    id: r.id as number,
    unit_id: r.unit_id as number,
    unit_number: unitNumber,
    tenant_id: tenant?.id ?? null,
    tenant_name: tenant?.name ?? null,
    tenant_phone: tenant?.phone ?? null,
    period: String(r.period),
    previous_reading: n(r.previous_reading),
    current_reading: n(r.current_reading),
    water_units: n(r.water_units),
    water_cost: n(r.water_cost),
    garbage_fee: n(r.garbage_fee),
    rent_amount: n(r.rent_amount),
    total_due: n(r.total_due),
    arrears: n(r.arrears),
    amount_paid: n(r.amount_paid),
    balance: n(r.balance),
  };
}

export async function getStatement(user: AuthUser, propertyId: number, period: string) {
  const prop = await ownedProperty(propertyId, user.id);
  if (!prop) return null;
  const db = getPool();
  const waterRate = prop.water_rate_per_unit != null ? n(prop.water_rate_per_unit) : 150;
  const garbage = prop.garbage_fee != null ? n(prop.garbage_fee) : 200;
  const prev = prevPeriod(period);

  const units = await db.query<{ id: number; unit_number: string; rent_amount: unknown }>(
    `SELECT id, unit_number, rent_amount FROM units
     WHERE property_id = $1 AND COALESCE(is_unused, false) = false
     ORDER BY unit_number`,
    [propertyId],
  );
  const unitIds = units.rows.map((u) => u.id);

  const tenantsByUnit = new Map<number, { id: number; name: string; phone: string | null }>();
  const currentByUnit = new Map<number, Record<string, unknown>>();
  const prevByUnit = new Map<number, { current_reading: unknown; balance: unknown }>();

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
      `SELECT * FROM meter_readings WHERE unit_id = ANY($1::int[]) AND period = ANY($2::text[])`,
      [unitIds, [period, prev]],
    );
    for (const row of readings.rows) {
      if (row.period === period) currentByUnit.set(row.unit_id, row);
      if (row.period === prev) prevByUnit.set(row.unit_id, row);
    }
  }

  const lines = [];
  for (const unit of units.rows) {
    const tenant = tenantsByUnit.get(unit.id) || null;
    const existing = currentByUnit.get(unit.id);
    if (existing) {
      lines.push(lineFromReading(existing, unit.unit_number, tenant));
      continue;
    }

    const last = prevByUnit.get(unit.id);
    const previous = last ? n(last.current_reading) : 0;
    const arrears = last ? n(last.balance) : 0;
    const rent = n(unit.rent_amount);
    const totalDue = garbage + rent;
    lines.push({
      id: null,
      unit_id: unit.id,
      unit_number: unit.unit_number,
      tenant_id: tenant?.id ?? null,
      tenant_name: tenant?.name ?? null,
      tenant_phone: tenant?.phone ?? null,
      period,
      previous_reading: previous,
      current_reading: previous,
      water_units: 0,
      water_cost: 0,
      garbage_fee: garbage,
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
      const unit = await client.query<{ id: number; unit_number: string; rent_amount: unknown }>(
        `SELECT id, unit_number, rent_amount FROM units
         WHERE id = $1 AND property_id = $2 AND COALESCE(is_unused, false) = false`,
        [item.unit_id, propertyId],
      );
      if (!unit.rows[0]) throw new Error(`Unit ${item.unit_id} not found on this property`);

      const last = await client.query(
        `SELECT current_reading, balance FROM meter_readings WHERE unit_id = $1 AND period = $2`,
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
      const garbage = garbageDefault;
      const rent = n(unit.rows[0].rent_amount);
      const totalDue = waterCost + garbage + rent;
      const arrears = last.rows[0] ? n(last.rows[0].balance) : 0;

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

      if (existing.rows[0]) {
        await client.query(
          `UPDATE meter_readings SET
             previous_reading = $1, current_reading = $2, water_units = $3, water_cost = $4,
             garbage_fee = $5, rent_amount = $6, total_due = $7, arrears = $8,
             amount_paid = $9, balance = $10
           WHERE id = $11`,
          [
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
            existing.rows[0].id,
          ],
        );
      } else {
        await client.query(
          `INSERT INTO meter_readings (
             unit_id, period, previous_reading, current_reading, water_units, water_cost,
             garbage_fee, rent_amount, total_due, arrears, amount_paid, balance
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
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
