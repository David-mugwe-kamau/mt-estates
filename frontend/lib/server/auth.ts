import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { getPool, jsonError } from "@/lib/server/db";
import { tokenFromRequest } from "@/lib/server/sessionCookie";

function secretKey() {
  const key = process.env.SECRET_KEY;
  if (!key) throw new Error("SECRET_KEY is not set");
  return new TextEncoder().encode(key);
}

function expireMinutes() {
  const n = Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || "10080");
  return Number.isFinite(n) && n > 0 ? n : 10080;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createAccessToken(userId: number, roles: string[]): Promise<string> {
  return new SignJWT({ roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setExpirationTime(`${expireMinutes()}m`)
    .sign(secretKey());
}

export async function decodeAccessToken(token: string): Promise<{ sub: string; roles?: string[] }> {
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
  if (!payload.sub) throw new Error("Invalid token");
  return { sub: String(payload.sub), roles: payload.roles as string[] | undefined };
}

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
};

export async function getRoleNames(userId: number): Promise<string[]> {
  const db = getPool();
  const r = await db.query<{ role: string }>(
    `SELECT role FROM user_roles WHERE user_id = $1 AND enabled = true ORDER BY role`,
    [userId],
  );
  return r.rows.map((x) => x.role);
}

export async function buildUserResponse(user: AuthUser) {
  const roles = await getRoleNames(user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar_url: user.avatar_url,
    role: user.role,
    roles,
    created_at: user.created_at,
  };
}

export async function buildUserMeResponse(user: AuthUser) {
  const base = await buildUserResponse(user);
  const admins = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return {
    ...base,
    subscriptions: [] as Array<Record<string, unknown>>,
    is_platform_admin: admins.includes(user.email.toLowerCase()),
  };
}

export async function requireUser(req: Request): Promise<AuthUser | Response> {
  const token = tokenFromRequest(req);
  if (!token) return jsonError("Not authenticated", 401);
  try {
    const payload = await decodeAccessToken(token);
    const db = getPool();
    const r = await db.query<AuthUser>(
      `SELECT id, name, email, phone, avatar_url, role, created_at::text AS created_at
       FROM users WHERE id = $1`,
      [Number(payload.sub)],
    );
    const user = r.rows[0];
    if (!user) return jsonError("Not authenticated", 401);
    return user;
  } catch {
    return jsonError("Invalid or expired token", 401);
  }
}

export function isAuthUser(v: AuthUser | Response): v is AuthUser {
  return typeof v === "object" && v !== null && "id" in v && "email" in v;
}
