"use client";

const TOKEN_KEY = "mt_estates_token";
const USER_KEY = "mt_estates_user";

export function saveSession(_token: string, user: object) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) return t;
  if (localStorage.getItem(USER_KEY)) return "cookie";
  return null;
}

export function getUser<T = { name: string; email: string; roles: string[] }>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function logout() {
  if (typeof window === "undefined") return;
  fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event("mt_auth_change"));
    window.location.href = "/auth/login";
  });
}
