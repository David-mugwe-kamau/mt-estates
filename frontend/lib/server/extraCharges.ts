import { getPool } from "@/lib/server/db";

export type ExtraCharge = { label: string; amount: number };

export function parseExtraCharges(raw: unknown): ExtraCharge[] {
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  const out: ExtraCharge[] = [];
  for (const item of data.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const label = String(rec.label || "").trim().slice(0, 80);
    const amount = Number(rec.amount);
    if (!label || !Number.isFinite(amount) || amount < 0) continue;
    out.push({ label, amount });
  }
  return out;
}

export function extraChargesSum(list: ExtraCharge[]): number {
  return list.reduce((s, x) => s + x.amount, 0);
}

let extraColsReady = false;
export async function ensureExtraChargeColumns() {
  if (extraColsReady) return;
  const db = getPool();
  try {
    await db.query(
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS extra_charges JSONB NOT NULL DEFAULT '[]'::jsonb`,
    );
    await db.query(`ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS extra_charges JSONB`);
    await db.query(
      `ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS extra_total NUMERIC(12,2) NOT NULL DEFAULT 0`,
    );
  } catch {
    // may already exist
  }
  extraColsReady = true;
}
