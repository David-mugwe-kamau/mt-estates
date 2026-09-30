"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { PasswordInput } from "@/components/PasswordInput";
import { passwordIssue } from "@/lib/passwordPolicy";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
    list_rentals: false,
    host_airbnb: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nextUrl, setNextUrl] = useState("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next) setNextUrl(next);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    const weak = passwordIssue(form.password, form.email, form.name);
    if (weak) {
      setError(weak);
      return;
    }
    setLoading(true);
    try {
      await auth.register({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        list_rentals: form.list_rentals,
        host_airbnb: form.host_airbnb,
      });
      // Auto-login after register
      const loginRes = await auth.login({ email: form.email, password: form.password });
      saveSession(loginRes.access_token || "cookie", loginRes.user);
      window.dispatchEvent(new Event("mt_auth_change"));
      window.location.href = nextUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
        <div className="mb-6 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">
            Join MT Estates
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Create your account
          </h1>
          <p className="text-sm text-slate-500">
            One account for rentals, Airbnbs, and property management.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">Full name *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="e.g. Jane Wanjiku"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-mt-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Email address *</label>
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
            <label className="block text-xs font-medium text-slate-600">
              Phone number <span className="text-slate-400">(optional)</span>
            </label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="+254 700 000 000"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-mt-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Password *</label>
            <PasswordInput
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="At least 8 characters, letters and a number"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Confirm password *</label>
            <PasswordInput
              name="confirm_password"
              value={form.confirm_password}
              onChange={handleChange}
              required
              placeholder="Repeat your password"
              autoComplete="new-password"
            />
          </div>

          {/* Role selection */}
          <div className="rounded-xl bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              I also want to…
            </p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="list_rentals"
                checked={form.list_rentals}
                onChange={handleChange}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-mt-blue"
              />
              <span className="text-sm text-slate-700">
                <span className="font-semibold">List rental properties</span>
                <br />
                <span className="text-slate-500">Manage units, tenants and payments</span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="host_airbnb"
                checked={form.host_airbnb}
                onChange={handleChange}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-mt-blue"
              />
              <span className="text-sm text-slate-700">
                <span className="font-semibold">Host an Airbnb</span>
                <br />
                <span className="text-slate-500">List short-stay spaces on MT Estates</span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-mt-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-mt-blue/90 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <a
            href={`/auth/login${nextUrl !== "/dashboard" ? `?next=${encodeURIComponent(nextUrl)}` : ""}`}
            className="font-semibold text-mt-blue hover:text-mt-orange"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
