"use client";

import { useEffect, useState, useRef } from "react";
import { getToken, saveSession, getUser } from "@/lib/auth";
import { auth } from "@/lib/api";
import type { UserResponse } from "@/lib/api";
import { compressImageForAvatar } from "@/lib/compressImage";
import { PasswordInput } from "@/components/PasswordInput";
import { passwordIssue } from "@/lib/passwordPolicy";

export default function ProfilePage() {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", avatar_url: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwOk, setPwOk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = "/auth/login?next=/dashboard/profile";
      return;
    }
    auth
      .me(token)
      .then((u) => {
        setUser(u);
        setForm({ name: u.name, phone: u.phone ?? "", avatar_url: u.avatar_url ?? "" });
      })
      .catch(() => {
        const local = getUser<UserResponse>();
        if (local) {
          setUser(local);
          setForm({ name: local.name, phone: local.phone ?? "", avatar_url: local.avatar_url ?? "" });
        } else {
          window.location.href = "/auth/login";
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const url = await compressImageForAvatar(file);
      setForm((prev) => ({ ...prev, avatar_url: url }));
    } catch {
      setError("Could not process that photo. Try another image.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const updated = await auth.updateProfile(
        {
          name: form.name || undefined,
          phone: form.phone || undefined,
          avatar_url: form.avatar_url || undefined,
        },
        token,
      );
      setUser(updated);
      saveSession(token, updated);
      window.dispatchEvent(new Event("mt_auth_change"));
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPwOk(false);
    const token = getToken();
    if (!token) return;
    if (pw.new_password !== pw.confirm) {
      setError("New passwords do not match.");
      return;
    }
    const weak = passwordIssue(pw.new_password, user?.email || "", form.name);
    if (weak) {
      setError(weak);
      return;
    }
    setPwSaving(true);
    try {
      await auth.changePassword(
        { current_password: pw.current_password, new_password: pw.new_password },
        token,
      );
      setPw({ current_password: "", new_password: "", confirm: "" });
      setPwOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-mt-blue border-t-transparent" />
      </div>
    );
  }

  const initials = user?.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?";

  return (
    <div className="mx-auto max-w-lg px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">My account</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Edit profile</h1>
        </div>
        <a href="/dashboard" className="text-sm font-medium text-mt-blue hover:text-mt-orange">
          ← Dashboard
        </a>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 space-y-5">
        <div className="flex flex-col items-center gap-3">
          {form.avatar_url ? (
            <img
              src={form.avatar_url}
              alt="Profile"
              className="h-20 w-20 rounded-full object-cover ring-4 ring-mt-blue/20"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-mt-blue/10 text-2xl font-extrabold text-mt-blue">
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs font-semibold text-mt-blue hover:text-mt-orange"
          >
            {form.avatar_url ? "Change photo" : "Upload photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-xs text-slate-400">Photos are compressed automatically for faster save</p>
        </div>

        {success && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">
            Profile updated successfully.
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">Full name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-mt-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Email address</label>
            <input
              value={user?.email ?? ""}
              disabled
              className="mt-1 w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-slate-400">Email cannot be changed</p>
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

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-mt-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-mt-blue/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Change password</h2>
        {pwOk && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">
            Password updated.
          </div>
        )}
        <form onSubmit={handlePassword} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Current password</label>
            <PasswordInput
              name="current_password"
              value={pw.current_password}
              onChange={(e) => setPw((p) => ({ ...p, current_password: e.target.value }))}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">New password</label>
            <PasswordInput
              name="new_password"
              value={pw.new_password}
              onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))}
              required
              placeholder="8+ characters, letters and a number"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Confirm new password</label>
            <PasswordInput
              name="confirm"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              required
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={pwSaving}
            className="w-full rounded-lg border border-mt-blue px-4 py-2.5 text-sm font-semibold text-mt-blue hover:bg-mt-blue hover:text-white disabled:opacity-60"
          >
            {pwSaving ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
