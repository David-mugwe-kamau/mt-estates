"use client";

import { useEffect, useMemo, useState } from "react";
import { getToken } from "@/lib/auth";
import { wishlist, viewings, type PropertyImage, type UnitTypeResponse } from "@/lib/api";

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#005B8E"/><stop offset="1" stop-color="#F47920"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><text x="50%" y="50%" fill="white" font-size="28" font-family="sans-serif" text-anchor="middle" dy=".3em">MT Estates</text></svg>`,
  );

export interface PropertyDetailData {
  id: number;
  title: string;
  location: string;
  price: string;
  image: string;
  description?: string | null;
  contactPhone?: string | null;
  contactWhatsapp?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  type: "rental" | "airbnb" | "for_sale";
  images?: PropertyImage[];
  unitTypes?: UnitTypeResponse[];
  similar?: Array<{ id: number; name: string; location: string; image_url: string | null; min_rent: number | null }>;
}

function whatsappUrl(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, "");
  const number = cleaned.startsWith("0") ? `254${cleaned.slice(1)}` : cleaned;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function mapsUrl(location: string, lat?: number | null, lng?: number | null): string {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

function mapsEmbedUrl(location: string, lat?: number | null, lng?: number | null): string {
  const query = lat && lng ? `${lat},${lng}` : encodeURIComponent(location);
  return `https://maps.google.com/maps?q=${query}&output=embed&z=15`;
}

export function PropertyDetail({ property }: { property: PropertyDetailData }) {
  const types = property.unitTypes ?? [];
  const [activeType, setActiveType] = useState(0);
  const [active, setActive] = useState(0);
  const gallery = useMemo(() => {
    const typed = types[activeType]?.images?.map((i) => i.url) ?? [];
    if (typed.length > 0) return typed;
    if (property.images && property.images.length > 0) return property.images.map((i) => i.url);
    return [property.image || PLACEHOLDER];
  }, [property, types, activeType]);

  useEffect(() => {
    setActive(0);
  }, [activeType]);

  const [saved, setSaved] = useState(false);
  const [wishlistId, setWishlistId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [viewingOpen, setViewingOpen] = useState(false);
  const [preferredDate, setPreferredDate] = useState("");
  const [viewingMsg, setViewingMsg] = useState("");
  const [viewingStatus, setViewingStatus] = useState("");
  const [toast, setToast] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    setLoggedIn(!!token);
    if (!token) return;
    wishlist
      .list(token)
      .then((items) => {
        const found = items.find((i) => i.external_ref === String(property.id));
        if (found) {
          setSaved(true);
          setWishlistId(found.id);
        }
      })
      .catch(() => undefined);
  }, [property.id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function handleSave() {
    if (!loggedIn) {
      window.location.href = `/auth/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const token = getToken()!;
    setSaving(true);
    try {
      if (saved && wishlistId) {
        await wishlist.remove(wishlistId, token);
        setSaved(false);
        setWishlistId(null);
        showToast("Removed from wishlist");
      } else {
        const item = await wishlist.add(
          {
            title: property.title,
            location_text: property.location,
            listing_type: property.type,
            notes: null,
            external_ref: String(property.id),
          },
          token,
        );
        setSaved(true);
        setWishlistId(item.id);
        showToast("Saved to wishlist");
      }
    } catch {
      showToast("Could not update wishlist");
    } finally {
      setSaving(false);
    }
  }

  async function handleBookViewing(e: React.FormEvent) {
    e.preventDefault();
    if (!loggedIn) {
      window.location.href = `/auth/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const token = getToken()!;
    setViewingStatus("Sending…");
    try {
      await viewings.create(
        {
          property_id: property.id,
          preferred_date: preferredDate || undefined,
          message: viewingMsg || `I'd like to view ${property.title}`,
        },
        token,
      );
      setViewingStatus("Request sent! The landlord will respond soon.");
      setViewingOpen(false);
      showToast("Viewing request sent");
    } catch (err) {
      setViewingStatus(err instanceof Error ? err.message : "Failed to book viewing");
    }
  }

  async function copyListingLink(url: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return true;
      }
    } catch {
      /* try legacy */
    }
    try {
      const el = document.createElement("textarea");
      el.value = url;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.focus();
      el.select();
      el.setSelectionRange(0, url.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }

  async function handleShare() {
    const url = window.location.href;
    const shareText = `${property.title} — ${property.location} on MT Estates`;
    const payload = { title: property.title, text: shareText, url };

    // Maps-style: prefer the phone/OS share sheet when the browser allows it (HTTPS / localhost)
    if (typeof navigator.share === "function") {
      const can =
        typeof navigator.canShare !== "function" || navigator.canShare(payload);
      if (can) {
        try {
          await navigator.share(payload);
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          /* fall through to small fallback (typical on http:// LAN phones) */
        }
      }
    }
    setShareOpen(true);
  }

  async function shareCopyLink() {
    const url = window.location.href;
    if (await copyListingLink(url)) {
      showToast("Link copied");
      setShareOpen(false);
      return;
    }
    window.prompt("Copy this listing link:", url);
    setShareOpen(false);
  }

  function shareViaWhatsApp() {
    const url = window.location.href;
    const shareText = `${property.title} — ${property.location} on MT Estates\n${url}`;
    setShareOpen(false);
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  }

  const activeTypeData = types[activeType];
  const rentPart =
    activeTypeData?.rent_amount != null || activeTypeData?.min_rent != null
      ? ` (KSh ${Number(activeTypeData.rent_amount ?? activeTypeData.min_rent).toLocaleString("en-KE")}${
          property.type === "airbnb" ? "/night" : "/month"
        })`
      : "";
  const typePart = activeTypeData?.label ? `the ${activeTypeData.label}` : "a unit";
  const waMessage =
    property.type === "for_sale"
      ? `Hi, I'm interested in "${property.title}" on MT Estates. Can we talk?`
      : `Hello, I am interested in ${typePart} at ${property.title}, ${property.location}${rentPart} listed on MT Estates.`;

  const typeLabel = property.type === "airbnb" ? "Airbnb" : property.type === "for_sale" ? "For Sale" : "Rental";
  const backHref = property.type === "airbnb" ? "/airbnbs" : property.type === "for_sale" ? "/for-sale" : "/rentals";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <a href="/" className="hover:text-mt-blue">Home</a>
        <span>/</span>
        <a href={backHref} className="hover:text-mt-blue">{typeLabel}s</a>
        <span>/</span>
        <span className="font-medium text-slate-900">{property.title}</span>
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr,340px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl bg-slate-100">
            <img src={gallery[active] || PLACEHOLDER} alt={property.title} className="h-72 w-full object-cover md:h-96" />
            {gallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto bg-white p-3">
                {gallery.map((src, i) => (
                  <button key={i} type="button" onClick={() => setActive(i)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg ring-2 ${active === i ? "ring-mt-blue" : "ring-transparent"}`}>
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <span className="inline-block rounded-full bg-mt-orange/10 px-3 py-1 text-xs font-semibold text-mt-orange">{typeLabel}</span>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{property.title}</h1>
            <p className="text-sm text-slate-500">{property.location}</p>
            <p className={`text-xl font-bold ${property.type === "airbnb" ? "text-mt-orange" : "text-mt-blue"}`}>{property.price}</p>
          </div>

          {types.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {types.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveType(i)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      i === activeType ? "bg-mt-blue text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {t.label}
                    {t.min_rent != null || t.rent_amount != null
                      ? ` · KSh ${Number(t.rent_amount ?? t.min_rent).toLocaleString("en-KE")}`
                      : ""}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">Available to rent</p>
            </div>
          )}

          {property.description && (
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">About this property</h2>
              <p className="text-sm leading-relaxed text-slate-600">{property.description}</p>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between border-b bg-white px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">Location</h2>
              <a href={mapsUrl(property.location, property.latitude, property.longitude)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-mt-blue hover:text-mt-orange">
                Get directions
              </a>
            </div>
            <iframe title="map" src={mapsEmbedUrl(property.location, property.latitude, property.longitude)} width="100%" height="260" style={{ border: 0 }} loading="lazy" />
          </div>

          {property.similar && property.similar.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">Similar listings</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {property.similar.map((s) => (
                  <a key={s.id} href={`${backHref}/${s.id}`} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100 hover:ring-mt-blue/30">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <p className="truncate text-xs text-slate-500">{s.location}</p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="sticky top-20 space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Contact for viewing</h2>
            <p className="text-xs text-slate-500">Call or WhatsApp the landlord / host to arrange a viewing.</p>

            {property.contactWhatsapp && (
              <a href={whatsappUrl(property.contactWhatsapp, waMessage)} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white hover:bg-green-600">
                WhatsApp
              </a>
            )}
            {property.contactPhone && (
              <a href={`tel:${property.contactPhone}`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-mt-blue px-4 py-3 text-sm font-semibold text-mt-blue hover:bg-mt-blue hover:text-white">
                Call
              </a>
            )}

            <button type="button" onClick={() => (loggedIn ? setViewingOpen((v) => !v) : (window.location.href = `/auth/login?next=${encodeURIComponent(window.location.pathname)}`))} className="w-full rounded-xl bg-mt-orange px-4 py-3 text-sm font-semibold text-white hover:bg-mt-orange/90">
              Book a viewing
            </button>

            {viewingOpen && (
              <form onSubmit={handleBookViewing} className="space-y-2 rounded-xl bg-slate-50 p-3">
                <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <textarea value={viewingMsg} onChange={(e) => setViewingMsg(e.target.value)} placeholder="Message (optional)" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <button type="submit" className="w-full rounded-lg bg-mt-blue px-3 py-2 text-sm font-semibold text-white">Send request</button>
              </form>
            )}
            {viewingStatus && <p className="text-xs text-slate-600">{viewingStatus}</p>}

            <button type="button" onClick={handleSave} disabled={saving} className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-60 ${saved ? "border-mt-orange bg-mt-orange/5 text-mt-orange" : "border-slate-200 text-slate-600 hover:border-mt-orange hover:text-mt-orange"}`}>
              {saving ? "Saving…" : saved ? "Saved to wishlist" : "Save to wishlist"}
            </button>

            <button type="button" onClick={handleShare} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-mt-blue hover:text-mt-blue">
              Share listing
            </button>

            {shareOpen && (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700">Share listing</p>
                  <button
                    type="button"
                    onClick={() => setShareOpen(false)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Close
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  System share isn’t available on this connection. Use a quick option:
                </p>
                <button
                  type="button"
                  onClick={shareViaWhatsApp}
                  className="flex w-full items-center justify-center rounded-lg bg-green-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-green-600"
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={shareCopyLink}
                  className="flex w-full items-center justify-center rounded-lg border border-mt-blue bg-white px-3 py-2.5 text-sm font-semibold text-mt-blue hover:bg-mt-blue hover:text-white"
                >
                  Copy link
                </button>
              </div>
            )}

            {!loggedIn && (
              <p className="text-center text-xs text-slate-400">
                <a href={`/auth/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`} className="underline hover:text-mt-blue">Sign in</a> to save or book a viewing
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
