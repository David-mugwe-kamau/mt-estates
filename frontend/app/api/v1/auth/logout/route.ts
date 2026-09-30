import { logoutHandler } from "@/lib/server/authHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return logoutHandler();
}
