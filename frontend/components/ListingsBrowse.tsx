"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { listings, type PublicListing } from "@/lib/api";
import { ListingCard } from "@/components/ListingCard";
import { AreaScopePicker } from "@/components/AreaScopePicker";
import { formatPlaceLabel } from "@/lib/kenyaPlaces";
import { UNIT_CATEGORIES } from "@/lib/apartmentTypes";

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#005B8E"/><stop offset="1" stop-color="#F47920"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><text x="50%" y="50%" fill="white" font-size="28" font-family="sans-serif" text-anchor="middle" dy=".3em">MT Estates</text></svg>`,
  );

function formatPrice(minRent: number | null, type: string): string {
  if (minRent == null) return "Price on request";
  const amount = `KSh ${Number(minRent).toLocaleString("en-KE")}`;
  if (type === "airbnb") return `${amount} / night`;
  if (type === "for_sale") return amount;
  return `${amount} / month`;
}

function cardType(listingType: string | null): "rental" | "airbnb" | "for_sale" {
  if (listingType === "airbnb") return "airbnb";
  if (listingType === "for_sale") return "for_sale";
  return "rental";
}

interface Props {
  listingType: "rental" | "airbnb" | "for_sale";
  eyebrow: string;
  title: string;
  subtitle: string;
  emptyCtaHref?: string;
}

export function ListingsBrowse({ listingType, eyebrow, title, subtitle, emptyCtaHref = "/auth/register" }: Props) {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(listingType !== "rental");
  const [error, setError] = useState("");
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [draftCounty, setDraftCounty] = useState(searchParams.get("county") ?? "");
  const [draftLocality, setDraftLocality] = useState(searchParams.get("locality") ?? "");

  const location = searchParams.get("location") ?? undefined;
  const county = searchParams.get("county") ?? undefined;
  const locality = searchParams.get("locality") ?? undefined;
  const minPrice = searchParams.get("min_price") ? Number(searchParams.get("min_price")) : undefined;
  const maxPrice = searchParams.get("max_price") ? Number(searchParams.get("max_price")) : undefined;
  const lat = searchParams.get("lat") ? Number(searchParams.get("lat")) : undefined;
  const lng = searchParams.get("lng") ? Number(searchParams.get("lng")) : undefined;
  const category = searchParams.get("category") ?? undefined;

  const requireScope = listingType === "rental";
  const hasScope = requireScope
    ? Boolean(county || locality || (lat != null && lng != null))
    : true;
  const showTypeChips = listingType === "rental" && hasScope;

  useEffect(() => {
    if (requireScope && !hasScope) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    listings
      .public({
        listing_type: listingType,
        location,
        county,
        locality,
        min_price: minPrice,
        max_price: maxPrice,
        lat,
        lng,
        radius: lat != null && lng != null ? 20 : undefined,
        category: listingType === "rental" ? category : undefined,
      })
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load listings"))
      .finally(() => setLoading(false));
  }, [listingType, location, county, locality, minPrice, maxPrice, lat, lng, category, requireScope, hasScope]);

  function buildParams(extra?: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    if (county) params.set("county", county);
    if (locality) params.set("locality", locality);
    if (lat != null) params.set("lat", String(lat));
    if (lng != null) params.set("lng", String(lng));
    if (minPrice) params.set("min_price", String(minPrice));
    if (maxPrice) params.set("max_price", String(maxPrice));
    if (category) params.set("category", category);
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => {
        if (v === undefined || v === "") params.delete(k);
        else params.set(k, v);
      });
    }
    return params;
  }

  function applyArea() {
    if (!draftCounty) {
      setError("Choose a county, or use Near me.");
      return;
    }
    const params = new URLSearchParams();
    params.set("county", draftCounty);
    if (draftLocality.trim()) params.set("locality", draftLocality.trim());
    if (minPrice) params.set("min_price", String(minPrice));
    if (maxPrice) params.set("max_price", String(maxPrice));
    if (category) params.set("category", category);
    window.location.href = `${window.location.pathname}?${params.toString()}`;
  }

  function handleNearMe() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device.");
      return;
    }
    setNearMeLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const params = new URLSearchParams();
        params.set("lat", String(pos.coords.latitude));
        params.set("lng", String(pos.coords.longitude));
        if (category) params.set("category", category);
        window.location.href = `${window.location.pathname}?${params.toString()}`;
      },
      () => {
        setError("Could not get your location. Please allow location access.");
        setNearMeLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function selectCategory(id: string | null) {
    const params = buildParams({ category: id ?? undefined });
    if (!id) params.delete("category");
    const q = params.toString();
    window.location.href = q ? `${window.location.pathname}?${q}` : window.location.pathname;
  }

  const scopeLabel = lat != null
    ? "Within 20km of your location"
    : formatPlaceLabel(county ?? "", locality);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">{eyebrow}</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          <p className="text-slate-600">{subtitle}</p>
          {hasScope && scopeLabel ? (
            <p className="text-xs text-slate-500">{scopeLabel}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleNearMe}
          disabled={nearMeLoading}
          className="rounded-full border border-mt-blue px-4 py-2 text-sm font-semibold text-mt-blue hover:bg-mt-blue hover:text-white disabled:opacity-60"
        >
          {nearMeLoading ? "Locating…" : "Near me (20km)"}
        </button>
      </div>

      {requireScope && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 space-y-4">
          <p className="text-sm font-semibold text-slate-800">Where do you want to look?</p>
          <p className="text-xs text-slate-500">
            Rentals show only after you pick a county (and optionally an estate) or tap Near me.
          </p>
          <AreaScopePicker
            value={{ county: draftCounty, locality: draftLocality }}
            onChange={(next) => {
              setDraftCounty(next.county);
              setDraftLocality(next.locality);
            }}
          />
          <button
            type="button"
            onClick={applyArea}
            className="rounded-lg bg-mt-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-mt-blue/90"
          >
            Show rentals in this area
          </button>
        </div>
      )}

      {requireScope && !hasScope && !loading && (
        <div className="rounded-2xl bg-slate-50 p-10 text-center ring-1 ring-slate-100">
          <p className="text-lg font-semibold text-slate-800">Choose a place first</p>
          <p className="mt-1 text-sm text-slate-500">
            Select a county above, or use Near me to see homes within about 20km.
          </p>
        </div>
      )}

      {showTypeChips && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => selectCategory(null)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              !category ? "bg-mt-blue text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            All types
          </button>
          {UNIT_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectCategory(c.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                category === c.id ? "bg-mt-blue text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {hasScope && loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
      )}

      {hasScope && !loading && !error && items.length === 0 && (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-lg font-semibold text-slate-800">No listings in this area yet</p>
          <p className="mt-1 text-sm text-slate-500">Try another estate, the whole county, or list a property.</p>
          <a
            href={emptyCtaHref}
            className="mt-5 inline-block rounded-lg bg-mt-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-mt-blue/90"
          >
            List your property free
          </a>
        </div>
      )}

      {hasScope && !loading && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ListingCard
              key={item.id}
              id={item.id}
              title={item.name}
              location={item.location}
              price={formatPrice(item.min_rent, listingType)}
              image={item.image_url || PLACEHOLDER}
              type={cardType(item.listing_type)}
              latitude={item.latitude}
              longitude={item.longitude}
              vacantTypes={item.vacant_types}
            />
          ))}
        </div>
      )}
    </div>
  );
}
