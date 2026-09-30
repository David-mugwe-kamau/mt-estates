"use client";

import { useEffect, useMemo, useState } from "react";
import { getToken } from "@/lib/auth";
import { billing, type BillingLine, type BillingStatement } from "@/lib/api";

function money(n: number) {
  return Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fieldValue(v: number | string): string | number {
  return v === "" || v === undefined || v === null ? "" : v;
}

function toNum(v: number | string): number {
  if (v === "" || v === undefined || v === null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Empty editable cells show watermark placeholders — not painted-in zeros. */
function linesForForm(lines: BillingLine[]): BillingLine[] {
  return lines.map((l) => {
    if (l.id != null) {
      return {
        ...l,
        amount_paid: l.amount_paid ? l.amount_paid : ("" as unknown as number),
      };
    }
    return {
      ...l,
      previous_reading: (l.previous_reading ? l.previous_reading : "") as unknown as number,
      current_reading: "" as unknown as number,
      amount_paid: "" as unknown as number,
    };
  });
}

export default function BillingPage({ params }: { params: { id: string } }) {
  const propertyId = Number(params.id);
  const [period, setPeriod] = useState(currentPeriod());
  const [statement, setStatement] = useState<BillingStatement | null>(null);
  const [lines, setLines] = useState<BillingLine[]>([]);
  const [mainMeter, setMainMeter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load(p = period) {
    const token = getToken();
    if (!token) {
      setLoading(false);
      window.location.href = `/auth/login?next=/dashboard/properties/${propertyId}/billing`;
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await billing.get(propertyId, p, token);
      setStatement(data);
      setLines(linesForForm(data.lines));
      setMainMeter(data.main_meter_reading != null ? String(data.main_meter_reading) : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load billing");
      setStatement(null);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, period]);

  const liveLines = useMemo(() => {
    if (!statement) return [];
    const rate = statement.water_rate_per_unit;
    return lines.map((l) => {
      const previous = toNum(l.previous_reading as number | string);
      const current = toNum(l.current_reading as number | string);
      const water_units = Math.max(0, current - previous);
      const water_cost = water_units * rate;
      const garbage_fee = Number(l.garbage_fee) || 0;
      const rent_amount = Number(l.rent_amount) || 0;
      const total_due = water_cost + garbage_fee + rent_amount;
      const arrears = Number(l.arrears) || 0;
      const amount_paid = toNum(l.amount_paid as number | string);
      const balance = arrears + total_due - amount_paid;
      return { ...l, water_units, water_cost, total_due, arrears, balance };
    });
  }, [lines, statement]);

  const totals = useMemo(() => {
    const keys = [
      "water_units",
      "water_cost",
      "garbage_fee",
      "rent_amount",
      "arrears",
      "total_due",
      "amount_paid",
      "balance",
    ] as const;
    const t: Record<string, number> = {};
    for (const k of keys) t[k] = liveLines.reduce((s, l) => s + Number(l[k] || 0), 0);
    return t;
  }, [liveLines]);

  function updateLine(unitId: number, field: keyof BillingLine, value: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.unit_id !== unitId) return l;
        // Allow blank while typing so "0" does not stick in the field
        const next = value === "" ? ("" as unknown as number) : Number(value);
        return { ...l, [field]: next };
      }),
    );
  }

  async function handleSave() {
    const token = getToken();
    if (!token || !statement) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const data = await billing.save(
        propertyId,
        period,
        {
          readings: liveLines.map((l) => {
            const previous = toNum(l.previous_reading as number | string);
            const currentRaw = l.current_reading as number | string;
            const current =
              currentRaw === "" || currentRaw === undefined || currentRaw === null
                ? previous
                : toNum(currentRaw);
            return {
              unit_id: l.unit_id,
              previous_reading: previous,
              current_reading: current,
              amount_paid: toNum(l.amount_paid as number | string),
            };
          }),
          main_meter_reading: mainMeter === "" ? undefined : Number(mainMeter),
        },
        token,
      );
      setStatement(data);
      setLines(linesForForm(data.lines));
      setSuccess("Readings saved. Totals locked for this month.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleDownload() {
    if (!liveLines.length) return;
    const headers = [
      "Unit / house no.",
      "Tenant",
      "Initial",
      "Current",
      "Units",
      "Water",
      "Garbage",
      "Rent",
      "Arrears",
      "Total",
      "Paid",
      "Balance",
    ];
    const rows = liveLines.map((l) => [
      l.unit_number,
      l.tenant_name ?? "",
      toNum(l.previous_reading as number | string),
      toNum(l.current_reading as number | string),
      l.water_units,
      l.water_cost,
      l.garbage_fee,
      l.rent_amount,
      l.arrears || 0,
      l.total_due,
      toNum(l.amount_paid as number | string),
      l.balance,
    ]);
    rows.push([
      "Totals",
      "",
      "",
      "",
      totals.water_units || 0,
      totals.water_cost || 0,
      totals.garbage_fee || 0,
      totals.rent_amount || 0,
      totals.arrears || 0,
      totals.total_due || 0,
      totals.amount_paid || 0,
      totals.balance || 0,
    ]);
    const escape = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-${propertyId}-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-mt-blue border-t-transparent" />
        <p className="text-sm text-slate-500">Loading billing…</p>
      </div>
    );
  }

  if (!statement && error) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
        <p className="text-lg font-semibold text-slate-900">Could not load billing</p>
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => load(period)}
          className="rounded-lg bg-mt-blue px-4 py-2 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <div>
          <a href={`/dashboard/properties/${propertyId}`} className="text-sm font-medium text-mt-blue">
            ← Back to property
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mt-orange">Automated billing</p>
          <h1 className="text-2xl font-extrabold text-slate-900">Monthly readings</h1>
          <p className="text-sm text-slate-500">
            Enter current meter readings only. Water, totals and balances compute automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/dashboard/properties/${propertyId}`} className="text-sm font-medium text-mt-blue">← Property</a>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">
            Print
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={liveLines.length === 0}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Download
          </button>
        </div>
      </div>

      {statement && (
        <div className="rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-100 print:shadow-none">
          Water rate: <strong>KSh {money(statement.water_rate_per_unit)}</strong>/unit · Garbage:{" "}
          <strong>KSh {money(statement.garbage_fee)}</strong>/unit · Period: <strong>{period}</strong>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">Unit / house no.</th>
              <th className="px-3 py-3">Tenant</th>
              <th className="px-3 py-3">Initial</th>
              <th className="px-3 py-3">Current</th>
              <th className="px-3 py-3">Units</th>
              <th className="px-3 py-3">Water</th>
              <th className="px-3 py-3">Garbage</th>
              <th className="px-3 py-3">Rent</th>
              <th className="px-3 py-3">Arrears</th>
              <th className="px-3 py-3">Total</th>
              <th className="px-3 py-3">Paid</th>
              <th className="px-3 py-3">Balance</th>
            </tr>
          </thead>
          <tbody>
            {liveLines.map((l) => (
              <tr key={l.unit_id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold">{l.unit_number}</td>
                <td className="px-3 py-2 text-slate-600">
                  {l.tenant_name ? l.tenant_name : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={fieldValue(l.previous_reading as number | string)}
                    onChange={(e) => updateLine(l.unit_id, "previous_reading", e.target.value)}
                    placeholder="Initial"
                    className="w-20 rounded border border-slate-200 px-2 py-1 print:border-0"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={fieldValue(l.current_reading as number | string)}
                    onChange={(e) => updateLine(l.unit_id, "current_reading", e.target.value)}
                    placeholder="Current"
                    className="w-20 rounded border border-mt-blue/40 px-2 py-1 font-semibold print:border-0"
                  />
                </td>
                <td className="px-3 py-2">{money(l.water_units)}</td>
                <td className="px-3 py-2">{money(l.water_cost)}</td>
                <td className="px-3 py-2">{money(l.garbage_fee)}</td>
                <td className="px-3 py-2">{money(l.rent_amount)}</td>
                <td className="px-3 py-2">{money(l.arrears || 0)}</td>
                <td className="px-3 py-2 font-semibold text-mt-blue">{money(l.total_due)}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={fieldValue(l.amount_paid as number | string)}
                    onChange={(e) => updateLine(l.unit_id, "amount_paid", e.target.value)}
                    placeholder="Paid"
                    className="w-24 rounded border border-slate-200 px-2 py-1 print:border-0"
                  />
                </td>
                <td className={`px-3 py-2 font-semibold ${l.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                  {money(l.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
              <td className="px-3 py-3">Totals</td>
              <td />
              <td />
              <td />
              <td className="px-3 py-3">{money(totals.water_units || 0)}</td>
              <td className="px-3 py-3">{money(totals.water_cost || 0)}</td>
              <td className="px-3 py-3">{money(totals.garbage_fee || 0)}</td>
              <td className="px-3 py-3">{money(totals.rent_amount || 0)}</td>
              <td className="px-3 py-3">{money(totals.arrears || 0)}</td>
              <td className="px-3 py-3 text-mt-blue">{money(totals.total_due || 0)}</td>
              <td className="px-3 py-3">{money(totals.amount_paid || 0)}</td>
              <td className="px-3 py-3">{money(totals.balance || 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-4 print:hidden">
        <div>
          <label className="block text-xs font-medium text-slate-600">Main meter reading (optional)</label>
          <input
            type="number"
            value={mainMeter}
            onChange={(e) => setMainMeter(e.target.value)}
            placeholder="Optional"
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          {mainMeter !== "" && (
            <p className="mt-1 text-xs text-slate-500">
              Billed units {money(totals.water_units || 0)} vs main meter — difference flags possible leaks.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || liveLines.length === 0}
          className="rounded-lg bg-mt-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-mt-blue/90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save readings"}
        </button>
      </div>

      {liveLines.length === 0 && (
        <p className="text-sm text-slate-500">Add units / house numbers on the property page first, then return here to bill.</p>
      )}
    </div>
  );
}
