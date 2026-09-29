"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";

export type LocationValue = {
  location: string;
  latitude: number | null;
  longitude: number | null;
};

type PlaceHit = {
  display_name: string;
  lat: number;
  lng: number;
};

const NAIROBI: [number, number] = [-1.286389, 36.817223];

type Props = {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  required?: boolean;
  /** Short county/estate label — search drops the pin here; pin drags do not replace this name. */
  searchHint?: string;
};

function isRawCoords(label: string): boolean {
  return /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(label.trim());
}

export function LocationPicker({ value, onChange, required, searchHint }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const [query, setQuery] = useState(value.location);
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const skipSearch = useRef(false);
  const lastHint = useRef("");

  // Keep local query in sync when parent loads existing property
  useEffect(() => {
    setQuery(value.location);
  }, [value.location]);

  // Init map once
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!mapEl.current || mapRef.current) return;
      const L = (await import("leaflet")).default;

      // Fix default marker icons in bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (cancelled || !mapEl.current) return;

      const startLat = value.latitude ?? NAIROBI[0];
      const startLng = value.longitude ?? NAIROBI[1];
      const map = L.map(mapEl.current, { scrollWheelZoom: false }).setView([startLat, startLng], value.latitude ? 15 : 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
      marker.on("dragend", async () => {
        const pos = marker.getLatLng();
        await applyPin(pos.lat, pos.lng);
      });
      map.on("click", async (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(e.latlng);
        await applyPin(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 100);
    }
    init();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move marker when coordinates change externally
  useEffect(() => {
    if (!mapReady || !mapRef.current || !markerRef.current) return;
    if (value.latitude == null || value.longitude == null) return;
    const latlng = { lat: value.latitude, lng: value.longitude };
    markerRef.current.setLatLng(latlng);
    mapRef.current.setView(latlng, Math.max(mapRef.current.getZoom(), 14));
  }, [value.latitude, value.longitude, mapReady]);

  async function applyPin(lat: number, lng: number) {
    const existing = (value.location || query).trim();
    let label = existing;
    if (!label || isRawCoords(label)) {
      try {
        const res = await fetch(`/api/places/reverse?lat=${lat}&lng=${lng}`);
        if (res.ok) {
          const data = (await res.json()) as { display_name: string };
          label = data.display_name;
          skipSearch.current = true;
          setQuery(label);
        }
      } catch {
        /* keep existing label */
      }
    }
    onChange({
      location: label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      latitude: lat,
      longitude: lng,
    });
  }

  // Debounced Kenya place search — one request after a pause, pin to best match (will not hang)
  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
        if (!res.ok || cancelled) {
          if (!cancelled) setHits([]);
          return;
        }
        const data = (await res.json()) as PlaceHit[];
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setHits(list);
        setOpen(list.length > 0);
        const first = list[0];
        if (first) {
          onChange({
            location: q,
            latitude: first.lat,
            longitude: first.lng,
          });
        }
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const hint = (searchHint || "").trim();
    if (!hint) return;
    if (lastHint.current === "") {
      lastHint.current = hint;
      if (value.latitude != null && value.longitude != null) return;
    }
    if (hint === lastHint.current && value.latitude != null && value.longitude != null) return;
    lastHint.current = hint;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(hint)}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as PlaceHit[];
        const first = Array.isArray(data) ? data[0] : undefined;
        if (!first || cancelled) return;
        skipSearch.current = true;
        setQuery(hint);
        setHits([]);
        setOpen(false);
        onChange({
          location: hint,
          latitude: first.lat,
          longitude: first.lng,
        });
      } catch {
        /* keep current pin */
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchHint]);

  function pickPlace(place: PlaceHit) {
    skipSearch.current = true;
    setQuery(place.display_name);
    setHits([]);
    setOpen(false);
    onChange({
      location: place.display_name,
      latitude: place.lat,
      longitude: place.lng,
    });
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([place.lat, place.lng]);
      mapRef.current.setView([place.lat, place.lng], 15);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <label className="block text-xs font-medium text-slate-600">Location (Kenya) *</label>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange({
              location: e.target.value,
              latitude: value.latitude,
              longitude: value.longitude,
            });
            setOpen(true);
          }}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          required={required}
          placeholder="Search estate, town, or area e.g. Kilimani Nairobi"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-mt-blue focus:outline-none"
          autoComplete="off"
        />
        {searching && <p className="mt-1 text-xs text-slate-400">Searching places…</p>}
        {open && hits.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {hits.map((h) => (
              <li key={`${h.lat},${h.lng},${h.display_name}`}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-mt-blue/5"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickPlace(h)}
                >
                  {h.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs text-slate-500">
          Type a place — the pin jumps to the best Kenya match after you pause. Drag or tap to fine-tune. Your name stays.
        </p>
        <div ref={mapEl} className="h-56 w-full overflow-hidden rounded-xl ring-1 ring-slate-200" />
        {value.latitude != null && value.longitude != null && (
          <p className="mt-1 text-[11px] text-slate-400">
            Pin: {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
          </p>
        )}
      </div>
    </div>
  );
}
