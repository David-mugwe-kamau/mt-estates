"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { wishlist as wishlistApi } from "@/lib/api";
import type { WishlistItem } from "@/lib/api";

const TYPE_LABEL: Record<string, string> = {
  rental: "Rental",
  airbnb: "Airbnb",
  for_sale: "For Sale",
};

const TYPE_HREF: Record<string, string> = {
  rental: "/rentals",
  airbnb: "/airbnbs",
  for_sale: "/for-sale",
};

function AvailabilityBadge({ available }: { available: boolean | null }) {
  if (available === null || available === undefined) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        available
          ? "bg-green-50 text-green-700 ring-1 ring-green-200"
          : "bg-red-50 text-red-600 ring-1 ring-red-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${available ? "bg-green-500" : "bg-red-400"}`} />
      {available ? "Available" : "Not available"}
    </span>
  );
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = "/auth/login?next=/dashboard/wishlist";
      return;
    }
    wishlistApi
      .list(token)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleRemove(id: number) {
    const token = getToken();
    if (!token) return;
    setRemoving(id);
    try {
      await wishlistApi.remove(id, token);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setRemoving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-mt-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">My account</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Saved listings</h1>
        </div>
        <a href="/dashboard" className="text-sm font-medium text-mt-blue hover:text-mt-orange">
          ← Dashboard
        </a>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-4xl mb-3">❤️</p>
          <p className="text-lg font-semibold text-slate-800">No saved listings yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-5">
            Browse properties and tap "Save to wishlist" on any listing.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <a href="/rentals" className="rounded-lg bg-mt-blue px-4 py-2 text-sm font-semibold text-white hover:bg-mt-blue/90 transition">
              Browse Rentals
            </a>
            <a href="/airbnbs" className="rounded-lg border border-mt-blue px-4 py-2 text-sm font-semibold text-mt-blue hover:bg-mt-blue hover:text-white transition">
              Browse Airbnbs
            </a>
            <a href="/for-sale" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-mt-blue hover:text-mt-blue transition">
              For Sale
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-mt-blue/10 px-2.5 py-0.5 text-xs font-semibold text-mt-blue">
                    {TYPE_LABEL[item.listing_type] ?? item.listing_type}
                  </span>
                  <AvailabilityBadge available={item.is_available ?? null} />
                </div>
                <p className="font-semibold text-slate-900 truncate">{item.title}</p>
                {item.location_text && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {item.location_text}
                  </p>
                )}
                {item.notes && (
                  <p className="text-xs text-slate-400 italic">{item.notes}</p>
                )}
                <p className="text-xs text-slate-400">
                  Saved {new Date(item.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                {item.external_ref && (
                  <a
                    href={`${TYPE_HREF[item.listing_type] ?? "/rentals"}/${item.external_ref}`}
                    className="text-xs font-semibold text-mt-blue hover:text-mt-orange"
                  >
                    View →
                  </a>
                )}
                <button
                  onClick={() => handleRemove(item.id)}
                  disabled={removing === item.id}
                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                >
                  {removing === item.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
