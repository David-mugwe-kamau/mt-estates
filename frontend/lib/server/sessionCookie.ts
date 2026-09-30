function expireMinutes() {
  const n = Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || "10080");
  return Number.isFinite(n) && n > 0 ? n : 10080;
}

export const SESSION_COOKIE = "mt_session";

export function sessionCookieHeader(token: string) {
  const maxAge = expireMinutes() * 60;
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader() {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function tokenFromRequest(req: Request): string {
  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Bearer ")) {
    const t = header.slice(7).trim();
    if (t && t !== "cookie") return t;
  }
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}
