import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      ssl:
        url.includes("supabase") || url.includes("sslmode=require")
          ? { rejectUnauthorized: false }
          : undefined,
      max: 5,
      connectionTimeoutMillis: 12_000,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export function jsonError(detail: string, status: number) {
  return Response.json({ detail }, { status });
}
