"use client";

import { useState } from "react";
import { HeroSlider } from "@/components/HeroSlider";
import { AreaScopePicker } from "@/components/AreaScopePicker";

export default function HomePage() {
  const [lookingFor, setLookingFor] = useState("rental");
  const [location, setLocation] = useState("");
  const [area, setArea] = useState({ county: "", locality: "" });
  const [searchError, setSearchError] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [nearMeLoading, setNearMeLoading] = useState(false);

  function pathForType(type: string) {
    if (type === "airbnb") return "/airbnbs";
    if (type === "for_sale") return "/for-sale";
    return "/rentals";
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError("");
    const params = new URLSearchParams();
    if (lookingFor === "rental") {
      if (!area.county.trim()) {
        setSearchError("Pick a county, or use Near me.");
        return;
      }
      params.set("county", area.county.trim());
      if (area.locality.trim()) params.set("locality", area.locality.trim());
    } else if (location.trim()) {
      params.set("location", location.trim());
    }
    if (minPrice) params.set("min_price", minPrice);
    if (maxPrice) params.set("max_price", maxPrice);
    const qs = params.toString();
    window.location.href = `${pathForType(lookingFor)}${qs ? `?${qs}` : ""}`;
  }

  function handleNearMe() {
    if (!navigator.geolocation) return;
    setNearMeLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const params = new URLSearchParams();
        params.set("lat", String(pos.coords.latitude));
        params.set("lng", String(pos.coords.longitude));
        window.location.href = `${pathForType(lookingFor)}?${params.toString()}`;
      },
      () => setNearMeLoading(false),
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
      <section className="grid items-center gap-10 md:grid-cols-[1.4fr,1.6fr]">
        <div className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">
            Trusted property platform in Kenya
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
            Find trusted rentals, Airbnbs, and property deals in Kenya.
          </h1>
          <p className="mt-4 text-slate-600">
            MT Estates connects tenants, Airbnb guests, landlords, and serious buyers on one trusted platform.
            Landlords list for free. Pay only for powerful management tools when you need them.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/rentals" className="rounded-full bg-mt-blue px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-mt-blue/90">
              Find a rental
            </a>
            <a href="/airbnbs" className="rounded-full bg-mt-orange px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-mt-orange/90">
              Find an Airbnb
            </a>
            <a href="/auth/register" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-mt-blue hover:text-mt-blue">
              I&apos;m a landlord
            </a>
            <a href="/sell-property" className="rounded-full border border-mt-orange/40 px-6 py-2.5 text-sm font-semibold text-mt-orange shadow-sm hover:bg-mt-orange hover:text-white">
              Sell property with us
            </a>
          </div>
        </div>
        <div className="space-y-4">
          <HeroSlider />
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Quick search</h2>
            <form className="mt-4 space-y-4" onSubmit={handleSearch}>
              <div>
                <label className="block text-xs font-medium text-slate-600">Looking for</label>
                <select
                  value={lookingFor}
                  onChange={(e) => setLookingFor(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-mt-blue focus:outline-none"
                >
                  <option value="rental">Rentals</option>
                  <option value="airbnb">Airbnbs</option>
                  <option value="for_sale">Property for sale</option>
                </select>
              </div>
              {lookingFor === "rental" ? (
                <AreaScopePicker value={area} onChange={setArea} />
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-600">Location (town, estate or county)</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Nairobi, Thika Road, Mombasa"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-mt-blue focus:outline-none"
                  />
                </div>
              )}
              {searchError ? <p className="text-xs text-red-600">{searchError}</p> : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Min price (KSh)</label>
                  <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-mt-blue focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Max price (KSh)</label>
                  <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-mt-blue focus:outline-none" />
                </div>
              </div>
              <button type="submit" className="mt-2 w-full rounded-md bg-mt-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-mt-blue/90">
                Search
              </button>
              <button type="button" onClick={handleNearMe} disabled={nearMeLoading} className="w-full rounded-md border border-mt-blue px-4 py-2.5 text-sm font-semibold text-mt-blue hover:bg-mt-blue hover:text-white disabled:opacity-60">
                {nearMeLoading ? "Locating…" : "Near me (20km)"}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Explore by category</h2>
          <a href="/rentals" className="text-sm font-semibold text-mt-blue hover:text-mt-orange">View all listings</a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <a href="/rentals" className="group overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="h-44 overflow-hidden rounded-xl bg-gradient-to-br from-mt-blue to-mt-orange/70">
              <img
                src="/images/pic1.jpg"
                alt=""
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <h3 className="mt-3 text-lg font-bold text-slate-900">For Rent</h3>
            <p className="text-sm text-slate-600">Find apartments and houses by county, estate, or Near me.</p>
          </a>
          <a href="/airbnbs" className="group overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="h-44 overflow-hidden rounded-xl bg-gradient-to-br from-mt-orange to-mt-blue/70">
              <img
                src="/images/pic3.jpg"
                alt=""
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <h3 className="mt-3 text-lg font-bold text-slate-900">Airbnbs</h3>
            <p className="text-sm text-slate-600">Discover short-stay spaces with map-based discovery.</p>
          </a>
          <a href="/for-sale" className="group overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="h-44 overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 to-mt-blue">
              <img
                src="/images/pic2.jpg"
                alt=""
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <h3 className="mt-3 text-lg font-bold text-slate-900">For Sale</h3>
            <p className="text-sm text-slate-600">Curated sale properties approved by MT Estates.</p>
          </a>
        </div>
      </section>
    </div>
  );
}
