"use client";

import { useState } from "react";
import { getToken } from "@/lib/auth";
import { properties } from "@/lib/api";
import { LocationPicker, type LocationValue } from "@/components/LocationPicker";
import { AreaScopePicker } from "@/components/AreaScopePicker";
import { formatPlaceLabel } from "@/lib/kenyaPlaces";

export default function NewPropertyPage() {
  const [form, setForm] = useState({
    name: "",
    listing_type: "rental" as "rental" | "airbnb" | "for_sale",
    description: "",
    contact_phone: "",
    contact_whatsapp: "",
  });
  const [place, setPlace] = useState<LocationValue>({
    location: "",
    latitude: null,
    longitude: null,
  });
  const [area, setArea] = useState({ county: "", locality: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!area.county.trim() || !area.locality.trim()) {
      setError("Please choose a county and estate / town.");
      return;
    }
    const displayLocation = formatPlaceLabel(area.county, area.locality);
    const token = getToken();
    if (!token) {
      window.location.href = "/auth/login?next=/dashboard/properties/new";
      return;
    }
    setLoading(true);
    try {
      const created = await properties.create(
        {
          name: form.name,
          location: displayLocation,
          county: area.county,
          locality: area.locality,
          listing_type: form.listing_type,
          description: form.description || undefined,
          contact_phone: form.contact_phone || undefined,
          contact_whatsapp: form.contact_whatsapp || undefined,
          latitude: place.latitude ?? undefined,
          longitude: place.longitude ?? undefined,
        },
        token,
      );
      window.location.href = `/dashboard/properties/${created.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create listing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">New listing</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Create a listing</h1>
        </div>
        <a href="/dashboard/properties" className="text-sm font-medium text-mt-blue hover:text-mt-orange">
          ← Back
        </a>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">Listing type *</label>
            <select
              name="listing_type"
              value={form.listing_type}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-mt-blue focus:outline-none"
            >
              <option value="rental">Rental property</option>
              <option value="airbnb">Airbnb / short stay</option>
              <option value="for_sale">Property for sale</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Property name *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="e.g. Kilimani 2BR Apartment"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-mt-blue focus:outline-none"
            />
          </div>

          <AreaScopePicker
            value={area}
            onChange={setArea}
            requireLocality
          />
          <LocationPicker
            value={place}
            onChange={setPlace}
            searchHint={formatPlaceLabel(area.county, area.locality)}
          />

          <div>
            <label className="block text-xs font-medium text-slate-600">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe the property, amenities, and neighbourhood…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-mt-blue focus:outline-none"
            />
          </div>

          <div className="rounded-xl bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Viewing contact</p>
            <p className="text-xs text-slate-500">
              Phone or WhatsApp tenants use to arrange a viewing. Required before publishing.
            </p>
            <input
              name="contact_phone"
              value={form.contact_phone}
              onChange={handleChange}
              placeholder="Phone +254…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              name="contact_whatsapp"
              value={form.contact_whatsapp}
              onChange={handleChange}
              placeholder="WhatsApp +254…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-mt-blue px-4 py-3 text-sm font-semibold text-white hover:bg-mt-blue/90 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create & add photos"}
          </button>
        </form>
      </div>
    </div>
  );
}
