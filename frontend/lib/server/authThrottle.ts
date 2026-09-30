import { getPool } from "@/lib/server/db";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export async function throttleKey(req: Request, email: string) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return `${ip}|${email.toLowerCase()}`;
}

async function ensureTable() {
  await getPool().query(
    `CREATE TABLE IF NOT EXISTS auth_throttle (
       key TEXT PRIMARY KEY,
       fails INTEGER NOT NULL DEFAULT 0,
       locked_until TIMESTAMPTZ
     )`,
  );
}

export async function assertLoginAllowed(key: string): Promise<string | null> {
  try {
    await ensureTable();
    const r = await getPool().query<{ fails: number; locked_until: string | null }>(
      `SELECT fails, locked_until FROM auth_throttle WHERE key = $1`,
      [key],
    );
    const row = r.rows[0];
    if (row?.locked_until && new Date(row.locked_until) > new Date()) {
      return "Too many sign-in attempts. Try again in 15 minutes.";
    }
  } catch {
    return null;
  }
  return null;
}

export async function recordLoginFailure(key: string) {
  try {
    await ensureTable();
    await getPool().query(
      `INSERT INTO auth_throttle (key, fails, locked_until) VALUES ($1, 1, NULL)
       ON CONFLICT (key) DO UPDATE SET
         fails = CASE
           WHEN auth_throttle.locked_until IS NOT NULL AND auth_throttle.locked_until < NOW() THEN 1
           ELSE auth_throttle.fails + 1
         END`,
      [key],
    );
    await getPool().query(
      `UPDATE auth_throttle SET locked_until = NOW() + ($3::text || ' minutes')::interval
       WHERE key = $1 AND fails >= $2`,
      [key, MAX_FAILS, String(LOCK_MINUTES)],
    );
  } catch {
    // non-fatal
  }
}

export async function recordLoginSuccess(key: string) {
  try {
    await getPool().query(`DELETE FROM auth_throttle WHERE key = $1`, [key]);
  } catch {
    // non-fatal
  }
}
