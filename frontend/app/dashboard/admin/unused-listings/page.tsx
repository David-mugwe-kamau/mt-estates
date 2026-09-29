"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { admin, auth, type UnusedListing } from "@/lib/api";
import { isPlatformAdmin, LISTING_TYPE_LABEL } from "@/lib/roles";

export default function UnusedListingsAdminPage() {
  const [items, setItems] = useState<UnusedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [allowed, setAllowed] = useState(false);

  async function load(token: string) {
    setLoading(true);
    setError("");
    try {
      const rows = await admin.unusedListings(token);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load unused listings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = "/auth/login?next=/dashboard/admin/unused-listings";
      return;
    }
    auth
      .me(token)
      .then((u) => {
        if (!isPlatformAdmin(u)) {
          setAllowed(false);
          setLoading(false);
          return;
        }
        setAllowed(true);
        return load(token);
      })
      .catch(() => {
        window.location.href = "/auth/login?next=/dashboard/admin/unused-listings";
      });
  }, []);

  async function handleRestore(id: number) {
    const token = getToken();
    if (!token) return;
    setBusyId(id);
    setError("");
    try {
      await admin.restoreListing(id, token);
      await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurge(id: number) {
    if (
      !window.confirm(
        "Permanently delete this listing and its units/photos? This cannot be undone.",
      )
    ) {
      return;
    }
    const token = getToken();
    if (!token) return;
    setBusyId(id);
    setError("");
    try {
      await admin.purgeListing(id, token);
      await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-mt-blue border-t-transparent" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-3">
        <h1 className="text-xl font-bold text-slate-900">Admin only</h1>
        <p className="text-sm text-slate-500">
          Unused listing maintenance is limited to the MT Estates platform owner.
        </p>
        <a href="/dashboard" className="text-sm font-semibold text-mt-blue">
          ← Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">Maintenance</p>
          <h1 className="text-2xl font-extrabold text-slate-900">Unused listings</h1>
          <p className="text-sm text-slate-500">
            Hidden by landlords. Restore as draft, or permanently delete.
          </p>
        </div>
        <a href="/dashboard" className="text-sm font-medium text-mt-blue">
          ← Dashboard
        </a>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {items.length === 0 ? (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-100">
          No unused listings. When landlords remove a listing, it appears here.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          {items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {LISTING_TYPE_LABEL[p.listing_type ?? ""] ?? p.listing_type ?? "Listing"} · {p.location}
                </p>
                <p className="text-xs text-slate-400">
                  Hidden {p.unused_at ? new Date(p.unused_at).toLocaleString() : "—"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => handleRestore(p.id)}
                  className="rounded-lg border border-mt-blue px-3 py-1.5 text-xs font-semibold text-mt-blue hover:bg-mt-blue hover:text-white disabled:opacity-50"
                >
                  Restore
                </button>
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => handlePurge(p.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Delete forever
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
