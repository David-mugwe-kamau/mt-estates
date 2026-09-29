"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { viewings, type ViewingRequest } from "@/lib/api";

function listingHref(v: ViewingRequest): string {
  const type = v.listing_type;
  const base = type === "airbnb" ? "/airbnbs" : type === "for_sale" ? "/for-sale" : "/rentals";
  return `${base}/${v.property_id}`;
}

function waHref(phone: string, text: string): string {
  const cleaned = phone.replace(/\D/g, "");
  const number = cleaned.startsWith("0") ? `254${cleaned.slice(1)}` : cleaned;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function tenantConfirmMessage(v: ViewingRequest): string {
  const where = [v.property_name, v.property_location].filter(Boolean).join(", ");
  const date = v.preferred_date ? ` Preferred date: ${v.preferred_date}.` : "";
  return `Hi, my viewing for ${where} on MT Estates is confirmed. Let's agree a time.${date}`;
}

export default function MyViewingsPage() {
  const [items, setItems] = useState<ViewingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = "/auth/login?next=/dashboard/my-viewings";
      return;
    }
    viewings.mine(token).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-mt-blue border-t-transparent" /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">Tenant</p>
          <h1 className="text-2xl font-extrabold">My viewings</h1>
        </div>
        <a href="/dashboard" className="text-sm text-mt-blue">← Dashboard</a>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-100">
          No viewing requests yet. Open a listing and tap &quot;Book a viewing&quot;.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((v) => {
            const wa = (v.contact_whatsapp || v.contact_phone || "").trim();
            const call = (v.contact_phone || v.contact_whatsapp || "").trim();
            return (
              <div key={v.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{v.property_name}</p>
                    <p className="text-xs text-slate-500">{v.property_location}</p>
                    {v.preferred_date && <p className="mt-1 text-xs">Preferred date: {v.preferred_date}</p>}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize">{v.status}</span>
                </div>
                {v.status === "pending" && (
                  <p className="text-xs text-slate-500">Waiting for the landlord to confirm.</p>
                )}
                {v.status === "confirmed" && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600">Confirmed — contact the landlord to agree the time.</p>
                    <div className="flex flex-wrap gap-2">
                      {wa ? (
                        <a
                          href={waHref(wa, tenantConfirmMessage(v))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          WhatsApp
                        </a>
                      ) : null}
                      {call ? (
                        <a
                          href={`tel:${call}`}
                          className="rounded-lg border border-mt-blue px-3 py-1.5 text-xs font-semibold text-mt-blue"
                        >
                          Call
                        </a>
                      ) : null}
                    </div>
                  </div>
                )}
                {v.status === "declined" && (
                  <p className="text-xs text-slate-600">This viewing was declined. You can still open the listing.</p>
                )}
                <a href={listingHref(v)} className="inline-block text-xs font-semibold text-mt-blue hover:underline">
                  Open listing →
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
