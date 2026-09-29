"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { viewings, type ViewingRequest } from "@/lib/api";

function waHref(phone: string, text: string): string {
  const cleaned = phone.replace(/\D/g, "");
  const number = cleaned.startsWith("0") ? `254${cleaned.slice(1)}` : cleaned;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function confirmMessage(v: ViewingRequest): string {
  const where = [v.property_name, v.property_location].filter(Boolean).join(", ");
  const date = v.preferred_date ? ` Preferred date: ${v.preferred_date}.` : "";
  return `Hi${v.requester_name ? ` ${v.requester_name}` : ""}, your viewing for ${where} on MT Estates is confirmed. Let's agree a time.${date}`;
}

export default function ReceivedViewingsPage() {
  const [items, setItems] = useState<ViewingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = "/auth/login?next=/dashboard/viewings";
      return;
    }
    viewings
      .received(token)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: number, status: string) {
    const token = getToken();
    if (!token) return;
    const updated = await viewings.update(id, status, token);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
  }

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-mt-blue border-t-transparent" /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">Landlord</p>
          <h1 className="text-2xl font-extrabold">Viewing requests</h1>
        </div>
        <a href="/dashboard" className="text-sm text-mt-blue">← Dashboard</a>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-100">No viewing requests yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((v) => (
            <div key={v.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{v.property_name}</p>
                  <p className="text-xs text-slate-500">{v.property_location}</p>
                  <p className="mt-2 text-sm">{v.requester_name} · {v.requester_email}{v.requester_phone ? ` · ${v.requester_phone}` : ""}</p>
                  {v.preferred_date && <p className="text-xs text-slate-500">Preferred: {v.preferred_date}</p>}
                  {v.message && <p className="mt-1 text-sm text-slate-600">{v.message}</p>}
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize">{v.status}</span>
              </div>
              {v.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => updateStatus(v.id, "confirmed")} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">Confirm</button>
                  <button type="button" onClick={() => updateStatus(v.id, "declined")} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600">Decline</button>
                </div>
              )}
              {v.status === "confirmed" && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-slate-600">Confirmed — contact them to agree the time.</p>
                  {v.requester_phone ? (
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={waHref(v.requester_phone, confirmMessage(v))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        WhatsApp
                      </a>
                      <a
                        href={`tel:${v.requester_phone}`}
                        className="rounded-lg border border-mt-blue px-3 py-1.5 text-xs font-semibold text-mt-blue"
                      >
                        Call
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No phone on this account. Use the email above.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
