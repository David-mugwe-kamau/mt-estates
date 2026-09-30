"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { properties, units } from "@/lib/api";
import type { ExtraCharge, PropertyDetail, UnitResponse } from "@/lib/api";
import { GalleryManager } from "@/components/GalleryManager";
import { LocationPicker, type LocationValue } from "@/components/LocationPicker";
import { AreaScopePicker } from "@/components/AreaScopePicker";
import { formatPlaceLabel } from "@/lib/kenyaPlaces";
import { LISTING_TYPE_LABEL } from "@/lib/roles";
import { UNIT_CATEGORIES } from "@/lib/apartmentTypes";
import { buildPublishChecklist } from "@/lib/publishChecklist";

export default function EditPropertyPage({ params }: { params: { id: string } }) {
  const propertyId = Number(params.id);
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    contact_phone: "",
    contact_whatsapp: "",
    water_rate_per_unit: "150",
    garbage_fee: "200",
  });
  const [place, setPlace] = useState<LocationValue>({
    location: "",
    latitude: null,
    longitude: null,
  });
  const [area, setArea] = useState({ county: "", locality: "" });
  const [unitList, setUnitList] = useState<UnitResponse[]>([]);
  const [newUnit, setNewUnit] = useState({ unit_number: "", rent_amount: "", unit_type_id: "" });
  const [newType, setNewType] = useState({ category: "one_bedroom", custom_label: "", rent: "" });
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [editUnit, setEditUnit] = useState({ unit_number: "", rent_amount: "", status: "vacant" });
  const [billingOpen, setBillingOpen] = useState(false);
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadProperty() {
    const token = getToken();
    if (!token) {
      window.location.href = `/auth/login?next=/dashboard/properties/${propertyId}`;
      return;
    }
    const p = await properties.get(propertyId, token);
    setProperty(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      contact_phone: p.contact_phone ?? "",
      contact_whatsapp: p.contact_whatsapp ?? "",
      water_rate_per_unit: String(p.water_rate_per_unit ?? 150),
      garbage_fee: String(p.garbage_fee ?? 200),
    });
    setExtraCharges(p.extra_charges?.length ? p.extra_charges : []);
    setPlace({
      location: p.location,
      latitude: p.latitude,
      longitude: p.longitude,
    });
    setArea({
      county: p.county ?? "",
      locality: p.locality ?? "",
    });
    const u = await units.list(token, propertyId);
    setUnitList(u);
  }

  useEffect(() => {
    loadProperty()
      .catch(() => setError("Listing not found"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await properties.update(
        propertyId,
        {
          name: form.name,
          location: formatPlaceLabel(area.county, area.locality) || place.location,
          county: area.county || undefined,
          locality: area.locality || undefined,
          description: form.description || undefined,
          contact_phone: form.contact_phone || undefined,
          contact_whatsapp: form.contact_whatsapp || undefined,
          water_rate_per_unit: form.water_rate_per_unit ? Number(form.water_rate_per_unit) : undefined,
          garbage_fee: form.garbage_fee ? Number(form.garbage_fee) : undefined,
          extra_charges: extraCharges
            .map((c) => ({ label: c.label.trim(), amount: Number(c.amount) }))
            .filter((c) => c.label && Number.isFinite(c.amount) && c.amount >= 0),
          latitude: place.latitude ?? undefined,
          longitude: place.longitude ?? undefined,
        },
        token,
      );
      setSuccess("Changes saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    const token = getToken();
    if (!token || !property) return;

    const goingLive = !property.is_published;
    if (goingLive) {
      const phone = (form.contact_phone || property.contact_phone || "").trim();
      const wa = (form.contact_whatsapp || property.contact_whatsapp || "").trim();
      if (!phone && !wa) {
        setError("Add a viewing phone or WhatsApp number before publishing.");
        return;
      }
      if (property.listing_type === "rental" || property.listing_type === "airbnb") {
        const types = property.unit_types ?? [];
        if (types.length === 0) {
          setError("Add at least one apartment type before publishing.");
          return;
        }
        const ready = types.some(
          (t) =>
            t.is_vacant !== false &&
            (t.rent_amount != null || t.min_rent != null) &&
            (t.images?.length ?? 0) > 0,
        );
        if (!ready) {
          setError("Before publishing, add a vacant type with rent and at least one photo.");
          return;
        }
      }
    }

    setPublishing(true);
    setError("");
    try {
      const updated = await properties.update(
        propertyId,
        { is_published: !property.is_published },
        token,
      );
      setProperty((prev) => (prev ? { ...prev, is_published: updated.is_published } : prev));
      setSuccess(updated.is_published ? "Listing is now live on MT Estates!" : "Listing unpublished.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update publish status");
    } finally {
      setPublishing(false);
    }
  }

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token || !newUnit.unit_number || !newUnit.rent_amount) return;
    try {
      const created = await units.create(
        {
          property_id: propertyId,
          unit_number: newUnit.unit_number,
          rent_amount: Number(newUnit.rent_amount),
          unit_type_id: newUnit.unit_type_id ? Number(newUnit.unit_type_id) : undefined,
        },
        token,
      );
      setUnitList((prev) => [...prev, created]);
      setNewUnit({ unit_number: "", rent_amount: "", unit_type_id: newUnit.unit_type_id });
      setSuccess("Unit added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add unit");
    }
  }

  async function handleAddType(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setError("");
    try {
      await properties.addUnitType(
        propertyId,
        {
          category: newType.category,
          custom_label: newType.category === "other" ? newType.custom_label : undefined,
          rent_amount: newType.rent ? Number(newType.rent) : undefined,
        },
        token,
      );
      await loadProperty();
      setNewType({ category: "one_bedroom", custom_label: "", rent: "" });
      setSuccess("Type added. Set vacancy and photos — this type is what tenants see, not door numbers.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add type");
    }
  }

  async function handleTypeRent(typeId: number, rent: string) {
    const token = getToken();
    if (!token || rent === "") return;
    try {
      await properties.updateUnitType(propertyId, typeId, { rent_amount: Number(rent) }, token);
      await loadProperty();
      setSuccess("Rent saved for this type.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rent");
    }
  }

  async function handleTypeVacancy(typeId: number, isVacant: boolean) {
    const token = getToken();
    if (!token) return;
    try {
      await properties.updateUnitType(propertyId, typeId, { is_vacant: isVacant }, token);
      await loadProperty();
      setSuccess(
        isVacant
          ? "This type is vacant and will show on MT Estates."
          : "No vacancy — this type is hidden from public listings.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update vacancy");
    }
  }

  async function handleRemoveType(typeId: number) {
    if (!confirm("Remove this apartment type? Photos stay unused for admin; units of this type must be moved first.")) return;
    const token = getToken();
    if (!token) return;
    try {
      await properties.removeUnitType(propertyId, typeId, token);
      await loadProperty();
      setSuccess("Apartment type removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove type");
    }
  }

  function startEditUnit(u: UnitResponse) {
    setEditingUnitId(u.id);
    setEditUnit({
      unit_number: u.unit_number,
      rent_amount: String(u.rent_amount),
      status: u.status === "occupied" ? "occupied" : "vacant",
    });
    setError("");
  }

  async function handleSaveUnit(unitId: number) {
    const token = getToken();
    if (!token || !editUnit.unit_number || editUnit.rent_amount === "") return;
    try {
      const updated = await units.update(
        unitId,
        {
          unit_number: editUnit.unit_number,
          rent_amount: Number(editUnit.rent_amount),
          status: editUnit.status,
        },
        token,
      );
      setUnitList((prev) => prev.map((u) => (u.id === unitId ? updated : u)));
      setEditingUnitId(null);
      setSuccess("Unit updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update unit");
    }
  }

  async function handleUnitOccupancy(unitId: number, status: "vacant" | "occupied") {
    const token = getToken();
    if (!token) return;
    try {
      const updated = await units.update(unitId, { status }, token);
      setUnitList((prev) => prev.map((u) => (u.id === unitId ? updated : u)));
      setSuccess(
        status === "occupied"
          ? "Marked occupied for your records. Public listing still follows type vacancy above."
          : "Marked vacant for your records.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update occupancy");
    }
  }

  async function handleRemoveUnit(unitId: number) {
    if (!confirm("Remove this unit from the listing? It will be kept as unused for admin maintenance.")) return;
    const token = getToken();
    if (!token) return;
    try {
      await units.remove(unitId, token);
      setUnitList((prev) => prev.filter((u) => u.id !== unitId));
      if (editingUnitId === unitId) setEditingUnitId(null);
      setSuccess("Unit removed (kept as unused for admin).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove unit");
    }
  }

  async function handleDeleteListing() {
    if (!confirm("Remove this listing permanently? This cannot be undone.")) return;
    const token = getToken();
    if (!token) return;
    try {
      await properties.delete(propertyId, token);
      window.location.href = "/dashboard/properties";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove listing");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-mt-blue border-t-transparent" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-lg font-semibold">{error || "Listing not found"}</p>
        <a href="/dashboard/properties" className="mt-4 inline-block text-mt-blue">← Back</a>
      </div>
    );
  }

  const isAirbnb = property.listing_type === "airbnb";
  const priceLabel = isAirbnb ? "Price per night (KSh)" : "Monthly rent (KSh)";
  const unitLabel = isAirbnb ? "Room / unit / house number" : "Unit / house number";
  const publishChecks = buildPublishChecklist({
    listingType: property.listing_type,
    contactPhone: form.contact_phone || property.contact_phone,
    contactWhatsapp: form.contact_whatsapp || property.contact_whatsapp,
    types: property.unit_types,
  });
  const publishReady = publishChecks.every((c) => c.done);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">
            {LISTING_TYPE_LABEL[property.listing_type ?? ""] ?? "Listing"}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{property.name}</h1>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
              property.is_published
                ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {property.is_published ? "Live on site" : "Draft — not visible to public"}
          </span>
        </div>
        <a href="/dashboard/properties" className="text-sm font-medium text-mt-blue hover:text-mt-orange">
          ← My listings
        </a>
      </div>

      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">{success}</div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
      )}

      {/* Publish toggle */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Publish listing</p>
            <p className="text-xs text-slate-500">
              When live, tenants can find this on MT Estates browse pages.
            </p>
            {property.view_count != null && (
              <p className="mt-1 text-xs text-slate-400">{property.view_count} views</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {property.listing_type === "rental" && (
              <a
                href={`/dashboard/properties/${propertyId}/billing`}
                className="rounded-lg border border-mt-orange px-4 py-2.5 text-sm font-semibold text-mt-orange hover:bg-mt-orange hover:text-white"
              >
                Monthly billing
              </a>
            )}
            <button
              type="button"
              onClick={togglePublish}
              disabled={publishing}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                property.is_published
                  ? "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  : "bg-mt-orange text-white hover:bg-mt-orange/90"
              }`}
            >
              {publishing ? "Updating…" : property.is_published ? "Unpublish" : "Publish now"}
            </button>
          </div>
        </div>
        {!property.is_published && (
          <ul className="space-y-1.5 border-t border-slate-100 pt-3">
            {publishChecks.map((c) => (
              <li
                key={c.id}
                className={`flex items-start gap-2 text-xs ${
                  c.done ? "text-green-700" : "text-slate-600"
                }`}
              >
                <span className="mt-0.5 font-bold" aria-hidden>
                  {c.done ? "✓" : "○"}
                </span>
                <span>{c.label}</span>
              </li>
            ))}
            {publishReady ? (
              <li className="pt-1 text-xs font-semibold text-green-700">Ready to publish</li>
            ) : (
              <li className="pt-1 text-xs text-slate-500">
                Finish the open items above, then tap Publish now.
              </li>
            )}
          </ul>
        )}
      </div>

      {property.listing_type === "for_sale" && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <GalleryManager
            title="Photo gallery"
            hint={`Free — up to 6 photos. First photo becomes the cover.`}
            listingCoverId={property.cover_image_id}
            images={property.images}
            onUpload={async (url) => {
              const token = getToken()!;
              await properties.addImage(propertyId, url, token, property.images.length === 0);
              await loadProperty();
            }}
            onSetCover={async (imageId) => {
              const token = getToken()!;
              await properties.setCover(propertyId, imageId, token);
              await loadProperty();
            }}
            onUseAsListingCover={async (imageId) => {
              const token = getToken()!;
              await properties.setListingCover(propertyId, imageId, token);
              await loadProperty();
            }}
            onRemove={async (imageId) => {
              const token = getToken()!;
              await properties.removeImage(propertyId, imageId, token);
              await loadProperty();
            }}
          />
        </div>
      )}

      {property.listing_type !== "for_sale" && property.images.filter((i) => !i.unit_type_id).length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <GalleryManager
            title="Older listing photos"
            hint="These were uploaded before apartment types. Prefer adding new photos on a type so they are not duplicated."
            listingCoverId={property.cover_image_id}
            images={property.images.filter((i) => !i.unit_type_id)}
            onUpload={async (url) => {
              const token = getToken()!;
              await properties.addImage(propertyId, url, token, false);
              await loadProperty();
            }}
            onSetCover={async (imageId) => {
              const token = getToken()!;
              await properties.setCover(propertyId, imageId, token);
              await loadProperty();
            }}
            onUseAsListingCover={async (imageId) => {
              const token = getToken()!;
              await properties.setListingCover(propertyId, imageId, token);
              await loadProperty();
            }}
            onRemove={async (imageId) => {
              const token = getToken()!;
              await properties.removeImage(propertyId, imageId, token);
              await loadProperty();
            }}
          />
        </div>
      )}

      {/* Details form */}
      <form onSubmit={handleSave} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Listing details</h2>

        <div>
          <label className="block text-xs font-medium text-slate-600">Name</label>
          <input name="name" value={form.name} onChange={handleChange} required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
        </div>
        <AreaScopePicker value={area} onChange={setArea} requireLocality={property.listing_type === "rental"} />
        <LocationPicker
          value={place}
          onChange={setPlace}
          searchHint={formatPlaceLabel(area.county, area.locality)}
        />
        <div>
          <label className="block text-xs font-medium text-slate-600">Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Water rate per unit (KSh)</label>
            <input name="water_rate_per_unit" type="number" value={form.water_rate_per_unit} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Garbage fee (KSh)</label>
            <input name="garbage_fee" type="number" value={form.garbage_fee} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">Extra monthly charges (optional)</p>
          <p className="text-xs text-slate-500">
            Security, service charge, parking, and similar. Occupied houses get these on billing; vacant houses do not.
          </p>
          {extraCharges.map((c, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input
                value={c.label}
                onChange={(e) =>
                  setExtraCharges((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                }
                placeholder="Charge name"
                className="min-w-[140px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                value={c.amount || ""}
                onChange={(e) =>
                  setExtraCharges((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) || 0 } : x)),
                  )
                }
                placeholder="KSh"
                className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setExtraCharges((prev) => prev.filter((_, j) => j !== i))}
                className="text-xs font-semibold text-red-500"
              >
                Remove
              </button>
            </div>
          ))}
          {extraCharges.length < 20 && (
            <button
              type="button"
              onClick={() => setExtraCharges((prev) => [...prev, { label: "", amount: 0 }])}
              className="text-xs font-semibold text-mt-blue"
            >
              + Add charge
            </button>
          )}
        </div>

        <div className="space-y-2 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Viewing contact</p>
          <p className="text-xs text-slate-500">
            Phone or WhatsApp for tenants to arrange a viewing. Required before you publish.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="contact_phone" value={form.contact_phone} onChange={handleChange} placeholder="Phone +254…" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input name="contact_whatsapp" value={form.contact_whatsapp} onChange={handleChange} placeholder="WhatsApp +254…" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
        </div>

        <button type="submit" disabled={saving} className="rounded-lg bg-mt-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-mt-blue/90 disabled:opacity-60">
          {saving ? "Saving…" : "Save details"}
        </button>
      </form>

      {/* What tenants see — rental & airbnb */}
      {(property.listing_type === "rental" || property.listing_type === "airbnb") && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">What tenants see</h2>
          <p className="text-xs text-slate-500">Tenants see the type, not door numbers.</p>

          {(property.unit_types ?? []).length === 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-100">
              Add a type (e.g. 1 bedroom), set rent, then add photos. That is what appears on MT Estates.
            </p>
          )}

          <form onSubmit={handleAddType} className="flex flex-wrap gap-2">
            <select
              value={newType.category}
              onChange={(e) => setNewType((p) => ({ ...p, category: e.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {UNIT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            {newType.category === "other" && (
              <input
                value={newType.custom_label}
                onChange={(e) => setNewType((p) => ({ ...p, custom_label: e.target.value }))}
                placeholder="e.g. Mini flat"
                required
                className="flex-1 min-w-[140px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            )}
            <input
              type="number"
              min="0"
              value={newType.rent}
              onChange={(e) => setNewType((p) => ({ ...p, rent: e.target.value }))}
              placeholder={priceLabel}
              className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-lg bg-mt-blue px-4 py-2 text-sm font-semibold text-white">
              + Add type
            </button>
          </form>

          {(property.unit_types ?? []).map((t) => {
            const vacant = t.is_vacant !== false;
            return (
              <div key={t.id} className="rounded-xl border border-slate-100 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{t.label}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        vacant
                          ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {vacant ? "Vacant" : "Hidden from MT Estates"}
                    </span>
                  </div>
                  <button type="button" onClick={() => handleRemoveType(t.id)} className="text-xs font-semibold text-red-500">
                    Remove type
                  </button>
                </div>
                <TypeRentField
                  rent={t.rent_amount ?? t.min_rent}
                  priceSuffix={isAirbnb ? "/ night" : "/ mo"}
                  onSaveRent={(rent) => handleTypeRent(t.id, rent)}
                />
                <GalleryManager
                  title={`${t.label} photos`}
                  listingCoverId={property.cover_image_id}
                  images={t.images}
                  onUpload={async (url) => {
                    const token = getToken()!;
                    await properties.addImage(propertyId, url, token, t.images.length === 0, t.id);
                    await loadProperty();
                    setSuccess("Photo added to this type only.");
                  }}
                  onSetCover={async (imageId) => {
                    const token = getToken()!;
                    await properties.setCover(propertyId, imageId, token);
                    await loadProperty();
                    setSuccess("Type cover updated.");
                  }}
                  onUseAsListingCover={async (imageId) => {
                    const token = getToken()!;
                    await properties.setListingCover(propertyId, imageId, token);
                    await loadProperty();
                    setSuccess("Listing cover set from this photo (not duplicated).");
                  }}
                  onRemove={async (imageId) => {
                    const token = getToken()!;
                    await properties.removeImage(propertyId, imageId, token);
                    await loadProperty();
                    setSuccess("Photo removed.");
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleTypeVacancy(t.id, true)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      vacant ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    Vacant
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeVacancy(t.id, false)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      !vacant ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    No vacancy
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Door numbers — billing only */}
      {(property.listing_type === "rental" || property.listing_type === "airbnb") && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Units / house numbers (optional) · water and occupancy</h2>
              <p className="text-xs text-slate-500">
                Occupied / vacant here is for your management only. What tenants see is Vacant / No vacancy on the type above.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBillingOpen((v) => !v)}
              className="text-xs font-semibold text-mt-blue hover:underline"
            >
              {billingOpen ? "Hide" : "Show"}
            </button>
          </div>

          {billingOpen && (
            <div className="space-y-4 pt-1">
              {unitList.length === 0 ? (
                <p className="text-sm text-slate-500">No units / house numbers yet. Add them when you need billing.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {unitList.map((u) => (
                    <li key={u.id} className="py-3 text-sm space-y-2">
                      {editingUnitId === u.id ? (
                        <div className="flex flex-wrap gap-2 items-center">
                          <input
                            value={editUnit.unit_number}
                            onChange={(e) => setEditUnit((p) => ({ ...p, unit_number: e.target.value }))}
                            className="min-w-[100px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                          <input
                            type="number"
                            min="0"
                            value={editUnit.rent_amount}
                            onChange={(e) => setEditUnit((p) => ({ ...p, rent_amount: e.target.value }))}
                            className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                          <select
                            value={editUnit.status}
                            onChange={(e) => setEditUnit((p) => ({ ...p, status: e.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          >
                            <option value="vacant">Vacant</option>
                            <option value="occupied">Occupied</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleSaveUnit(u.id)}
                            className="rounded-lg bg-mt-blue px-3 py-2 text-xs font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUnitId(null)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-medium">{u.unit_number}</span>
                            {u.unit_type_id ? (
                              <span className="text-xs text-slate-500">
                                {(property.unit_types ?? []).find((t) => t.id === u.unit_type_id)?.label}
                              </span>
                            ) : null}
                            <span className="text-mt-blue font-semibold">
                              KSh {Number(u.rent_amount).toLocaleString()}
                              {isAirbnb ? " / night" : " / mo"}
                            </span>
                            <span className={`text-xs font-semibold ${u.status === "vacant" ? "text-green-600" : "text-slate-600"}`}>
                              {u.status === "occupied" ? "Occupied" : "Vacant"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUnitOccupancy(u.id, "vacant")}
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                u.status !== "occupied" ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              Vacant
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUnitOccupancy(u.id, "occupied")}
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                u.status === "occupied" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              Occupied
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditUnit(u)}
                              className="text-xs font-semibold text-mt-blue hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveUnit(u.id)}
                              className="text-xs font-semibold text-red-500 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={handleAddUnit} className="flex flex-wrap gap-2 pt-2">
                <select
                  value={newUnit.unit_type_id}
                  onChange={(e) => setNewUnit((p) => ({ ...p, unit_type_id: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Type (optional)</option>
                  {(property.unit_types ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  value={newUnit.unit_number}
                  onChange={(e) => setNewUnit((p) => ({ ...p, unit_number: e.target.value }))}
                  placeholder={unitLabel}
                  required
                  className="flex-1 min-w-[120px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  value={newUnit.rent_amount}
                  onChange={(e) => setNewUnit((p) => ({ ...p, rent_amount: e.target.value }))}
                  placeholder={priceLabel}
                  required
                  className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-lg border border-mt-blue px-4 py-2 text-sm font-semibold text-mt-blue hover:bg-mt-blue hover:text-white">
                  + Add
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      <div className="pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={handleDeleteListing}
          className="text-sm font-semibold text-red-500 hover:text-red-700"
        >
          Remove listing
        </button>
      </div>
    </div>
  );
}

function TypeRentField({
  rent,
  priceSuffix,
  onSaveRent,
}: {
  rent: number | null | undefined;
  priceSuffix: string;
  onSaveRent: (rent: string) => void;
}) {
  const [value, setValue] = useState(rent != null ? String(rent) : "");
  useEffect(() => {
    setValue(rent != null ? String(rent) : "");
  }, [rent]);
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Rent ${priceSuffix}`}
        className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={() => onSaveRent(value)}
        className="rounded-lg bg-mt-blue px-3 py-2 text-xs font-semibold text-white"
      >
        Save rent
      </button>
    </div>
  );
}
