import { NextRequest } from "next/server";
import { requireUser, isAuthUser } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/db";
import { buildStatementPdf } from "@/lib/server/statementPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    const listingName = String(body.listingName || "Statement");
    const asAt = String(body.asAt || "");
    const headers = Array.isArray(body.headers) ? body.headers.map((h: unknown) => String(h)) : [];
    const rows = Array.isArray(body.rows)
      ? body.rows.map((r: unknown) => (Array.isArray(r) ? r.map((c) => String(c ?? "")) : []))
      : [];
    if (!headers.length) return jsonError("Nothing to print", 400);
    const bytes = await buildStatementPdf({ listingName, asAt, headers, rows });
    if (bytes.length < 5 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "%PDF") {
      return jsonError("Could not create PDF", 500);
    }
    const filename = String(body.filename || "statement.pdf").replace(/[^\w.\-]+/g, "_");
    const safe = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safe}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not create PDF", 500);
  }
}
