"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { PasswordInput } from "@/components/PasswordInput";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nextUrl, setNextUrl] = useState("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next) setNextUrl(next);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await auth.login({ email: form.email, password: form.password });
      saveSession(res.access_token || "cookie", res.user);
      window.dispatchEvent(new Event("mt_auth_change"));
      window.location.href = nextUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
        <div className="mb-6 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">
            Welcome back
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Sign in to MT Estates
          </h1>
          <p className="text-sm text-slate-500">
            Your account for rentals, Airbnbs, and property management.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">Email address</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-mt-blue focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-600">Password</label>
              <a href="/auth/forgot-password" className="text-xs text-mt-blue hover:text-mt-orange">
                Forgot password?
              </a>
            </div>
            <PasswordInput
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="Your password"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-mt-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-mt-blue/90 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <a href="/auth/register" className="font-semibold text-mt-blue hover:text-mt-orange">
            Create one free
          </a>
        </p>
      </div>
    </div>
  );
}
