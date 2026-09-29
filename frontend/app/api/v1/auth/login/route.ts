import { NextRequest } from "next/server";
import { loginHandler } from "@/lib/server/authHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return loginHandler(req);
}
