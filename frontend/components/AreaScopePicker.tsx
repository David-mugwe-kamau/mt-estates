"use client";

import { useMemo, useState } from "react";
import { KENYA_COUNTIES, areasForCounty } from "@/lib/kenyaPlaces";

const CUSTOM = "__custom__";

export type AreaScope = {
  county: string;
  locality: string;
};

type Props = {
  value: AreaScope;
  onChange: (next: AreaScope) => void;
  requireLocality?: boolean;
  countyRequired?: boolean;
};

export function AreaScopePicker({
  value,
  onChange,
  requireLocality = false,
  countyRequired = true,
}: Props) {
  const listed = areasForCounty(value.county);
  const isListed = value.locality !== "" && listed.includes(value.locality);
  const [customMode, setCustomMode] = useState(
    () => Boolean(value.locality) && !listed.includes(value.locality),
  );
  const [filter, setFilter] = useState("");

  const suggestions = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return listed;
    return listed.filter((a) => a.toLowerCase().includes(q));
  }, [listed, filter]);

  function setCounty(county: string) {
    setCustomMode(false);
    setFilter("");
    onChange({ county, locality: "" });
  }

  function pickLocality(locality: string) {
    if (locality === CUSTOM) {
      setCustomMode(true);
      onChange({ ...value, locality: "" });
      return;
    }
    setCustomMode(false);
    onChange({ ...value, locality });
  }

  const selectValue = customMode || (value.locality && !isListed) ? CUSTOM : value.locality;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600">County {countyRequired ? "*" : ""}</label>
        <select
          value={value.county}
          required={countyRequired}
          onChange={(e) => setCounty(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-mt-blue focus:outline-none"
        >
          <option value="">Select county</option>
          {KENYA_COUNTIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {value.county ? (
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Estate / town {requireLocality ? "*" : "(optional — whole county)"}
          </label>
          <select
            value={selectValue}
            required={requireLocality}
            onChange={(e) => pickLocality(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-mt-blue focus:outline-none"
          >
            <option value="">{requireLocality ? "Select estate or town" : "All areas in this county"}</option>
            {suggestions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            {filter && suggestions.length === 0 ? null : null}
            <option value={CUSTOM}>Other estate / area…</option>
          </select>
          {listed.length > 8 && (
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter the list…"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          )}
          {(customMode || selectValue === CUSTOM) && (
            <input
              value={isListed ? "" : value.locality}
              onChange={(e) => onChange({ ...value, locality: e.target.value })}
              required={requireLocality}
              placeholder="Type estate, town or road"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-mt-blue focus:outline-none"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
