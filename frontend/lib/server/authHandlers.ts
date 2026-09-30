import { NextRequest } from "next/server";
import { getPool, jsonError } from "@/lib/server/db";
import { passwordIssue } from "@/lib/passwordPolicy";
import { clearSessionCookieHeader, sessionCookieHeader } from "@/lib/server/sessionCookie";
import {
  assertLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
  throttleKey,
} from "@/lib/server/authThrottle";
import {
  buildUserMeResponse,
  buildUserResponse,
  createAccessToken,
  getRoleNames,
  hashPassword,
  isAuthUser,
  requireUser,
  verifyPassword,
  type AuthUser,
} from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assignRoles(userId: number, listRentals: boolean, hostAirbnb: boolean) {
  const db = getPool();
  const roles = ["renter"];
  if (listRentals) roles.push("rental_landlord");
  if (hostAirbnb) roles.push("airbnb_host");
  for (const role of roles) {
    await db.query(
      `INSERT INTO user_roles (user_id, role, enabled) VALUES ($1, $2, true)
       ON CONFLICT ON CONSTRAINT uq_user_roles_user_role DO NOTHING`,
      [userId, role],
    );
  }
}

/** POST /api/v1/auth/register — handled by method routing below via separate files */
export async function registerHandler(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const phone = body.phone ? String(body.phone) : null;
    const listRentals = Boolean(body.list_rentals);
    const hostAirbnb = Boolean(body.host_airbnb);

    if (!name || !email || !password) return jsonError("Name, email and password are required", 400);
    const weak = passwordIssue(password, email, name);
    if (weak) return jsonError(weak, 400);

    const db = getPool();
    const exists = await db.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (exists.rows[0]) return jsonError("Email already registered", 400);

    const legacyRole = listRentals || hostAirbnb ? "landlord" : "user";
    const passwordHash = await hashPassword(password);
    const ins = await db.query<AuthUser>(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, avatar_url, role, created_at::text AS created_at`,
      [name, email, phone, passwordHash, legacyRole],
    );
    const user = ins.rows[0];
    await assignRoles(user.id, listRentals, hostAirbnb);
    return Response.json(await buildUserResponse(user));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Registration failed", 500);
  }
}

export async function loginHandler(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const key = await throttleKey(req, email);
    const locked = await assertLoginAllowed(key);
    if (locked) return jsonError(locked, 429);
    const db = getPool();
    const r = await db.query<AuthUser & { password_hash: string }>(
      `SELECT id, name, email, phone, avatar_url, role, created_at::text AS created_at, password_hash
       FROM users WHERE email = $1`,
      [email],
    );
    const row = r.rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      await recordLoginFailure(key);
      return jsonError("Invalid email or password", 401);
    }
    await recordLoginSuccess(key);
    const { password_hash: _, ...user } = row;
    const roles = await getRoleNames(user.id);
    const access_token = await createAccessToken(user.id, roles);
    return Response.json(
      {
        token_type: "bearer",
        user: await buildUserResponse(user),
      },
      { headers: { "Set-Cookie": sessionCookieHeader(access_token) } },
    );
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Login failed", 500);
  }
}

export async function meHandler(req: NextRequest) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    return Response.json(await buildUserMeResponse(user));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed", 500);
  }
}

export async function updateMeHandler(req: NextRequest) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    const db = getPool();
    const name = body.name !== undefined ? String(body.name) : user.name;
    const phone = body.phone !== undefined ? (body.phone ? String(body.phone) : null) : user.phone;
    const avatar =
      body.avatar_url !== undefined
        ? body.avatar_url
          ? String(body.avatar_url)
          : null
        : user.avatar_url;
    const r = await db.query<AuthUser>(
      `UPDATE users SET name = $1, phone = $2, avatar_url = $3 WHERE id = $4
       RETURNING id, name, email, phone, avatar_url, role, created_at::text AS created_at`,
      [name, phone, avatar, user.id],
    );
    return Response.json(await buildUserResponse(r.rows[0]));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Update failed", 500);
  }
}

export async function changePasswordHandler(req: NextRequest) {
  const user = await requireUser(req);
  if (!isAuthUser(user)) return user;
  try {
    const body = await req.json();
    const current = String(body.current_password || "");
    const next = String(body.new_password || "");
    const db = getPool();
    const r = await db.query<{ password_hash: string; email: string; name: string }>(
      `SELECT password_hash, email, name FROM users WHERE id = $1`,
      [user.id],
    );
    const row = r.rows[0];
    if (!row || !(await verifyPassword(current, row.password_hash))) {
      return jsonError("Current password is incorrect", 400);
    }
    const weak = passwordIssue(next, row.email, row.name);
    if (weak) return jsonError(weak, 400);
    if (current === next) return jsonError("Choose a different new password", 400);
    const passwordHash = await hashPassword(next);
    await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, user.id]);
    const roles = await getRoleNames(user.id);
    const access_token = await createAccessToken(user.id, roles);
    return Response.json(
      { message: "Password updated" },
      { headers: { "Set-Cookie": sessionCookieHeader(access_token) } },
    );
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not change password", 500);
  }
}

export async function logoutHandler() {
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookieHeader() },
  });
}
