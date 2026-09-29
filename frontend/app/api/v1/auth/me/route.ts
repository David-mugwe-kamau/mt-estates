import { NextRequest } from "next/server";
import { meHandler, updateMeHandler } from "@/lib/server/authHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return meHandler(req);
}

export async function PATCH(req: NextRequest) {
  return updateMeHandler(req);
}
