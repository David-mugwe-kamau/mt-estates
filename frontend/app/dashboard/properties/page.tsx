"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { properties } from "@/lib/api";
import type { PropertyResponse } from "@/lib/api";
import { LISTING_TYPE_LABEL } from "@/lib/roles";
import { myListingsNeedsLine } from "@/lib/publishChecklist";

export default function PropertiesPage() {
  const [items, setItems] = useState<PropertyResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = "/auth/login?next=/dashboard/properties";
      return;
    }
    properties
      .list(token)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-mt-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">Landlord / Host</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Listings</h1>
          <p className="text-sm text-slate-500">Manage rentals, Airbnbs, and property galleries.</p>
        </div>
        <div className="flex gap-2">
          <a href="/dashboard" className="text-sm font-medium text-mt-blue hover:text-mt-orange">
            ← Dashboard
          </a>
          <a
            href="/dashboard/properties/new"
            className="rounded-lg bg-mt-blue px-4 py-2 text-sm font-semibold text-white hover:bg-mt-blue/90"
          >
            + New listing
          </a>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-4xl mb-3">🏢</p>
          <p className="text-lg font-semibold text-slate-800">No listings yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-5">
            Create your first rental or Airbnb listing with a free photo gallery.
          </p>
          <a
            href="/dashboard/properties/new"
            className="inline-block rounded-lg bg-mt-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-mt-blue/90"
          >
            Create listing
          </a>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((p) => {
            const needs = myListingsNeedsLine(p);
            return (
            <a
              key={p.id}
              href={`/dashboard/properties/${p.id}`}
              className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 hover:ring-mt-blue/30 transition"
            >
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">🏠</div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-mt-blue/10 px-2 py-0.5 text-[10px] font-bold text-mt-blue uppercase">
                    {LISTING_TYPE_LABEL[p.listing_type ?? ""] ?? p.listing_type ?? "Listing"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      p.is_published
                        ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {p.is_published ? "Live" : "Draft"}
                  </span>
                  {(p.listing_type === "rental" || p.listing_type === "airbnb") &&
                    (p.type_count ?? 0) > 0 &&
                    p.has_vacant_type === false && (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white">
                        Hidden from MT Estates
                      </span>
                    )}
                </div>
                <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                <p className="text-xs text-slate-500 truncate">{p.location}</p>
                {(p.vacant_type_labels ?? []).length > 0 && (
                  <p className="text-xs text-slate-500 truncate">
                    {(p.vacant_type_labels ?? []).map((label) => `${label} · vacant`).join(" · ")}
                  </p>
                )}
                {needs ? (
                  <p className="text-xs font-medium text-mt-orange truncate">{needs}</p>
                ) : null}
                <div className="flex gap-2 shrink-0">
                {p.listing_type === "rental" && (
                  <a
                    href={`/dashboard/properties/${p.id}/billing`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-semibold text-mt-orange hover:underline"
                  >
                    Billing
                  </a>
                )}
                <p className="text-xs font-semibold text-mt-blue">Manage →</p>
                </div>
              </div>
            </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
