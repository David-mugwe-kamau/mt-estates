"use client";

import { useEffect, useMemo, useState } from "react";
import { getToken } from "@/lib/auth";
import { billing, type BillingLine, type BillingStatement } from "@/lib/api";
import { downloadPdfTable, asAtMonthLabel, statementFileName } from "@/lib/billingPdf";

function money(n: number) {
  return Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftPeriod(period: string, delta: number) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
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
  const now = currentPeriod();
  const [historyFrom, setHistoryFrom] = useState(shiftPeriod(now, -5));
  const [historyTo, setHistoryTo] = useState(now);
  const [historyLines, setHistoryLines] = useState<BillingLine[]>([]);
  const [historyName, setHistoryName] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);

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
      const vacant = l.occupancy === "vacant";
      const garbage_fee = vacant ? 0 : Number(l.garbage_fee) || 0;
      const rent_amount = vacant ? 0 : Number(l.rent_amount) || 0;
      const extra_charges = vacant ? [] : statement.extra_charges || l.extra_charges || [];
      const extras_total = vacant
        ? 0
        : extra_charges.reduce((s, c) => s + Number(c.amount || 0), 0) || Number(statement.extras_total) || 0;
      const total_due = water_cost + garbage_fee + rent_amount + extras_total;
      const arrears = Number(l.arrears) || 0;
      const amount_paid = toNum(l.amount_paid as number | string);
      const balance = arrears + total_due - amount_paid;
      return {
        ...l,
        extra_charges,
        water_units,
        water_cost,
        garbage_fee,
        rent_amount,
        extras_total,
        total_due,
        arrears,
        balance,
      };
    });
  }, [lines, statement]);

  const totals = useMemo(() => {
    const keys = [
      "water_units",
      "water_cost",
      "garbage_fee",
      "rent_amount",
      "extras_total",
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
        if (field === "tenant_name") return { ...l, tenant_name: value };
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
              tenant_name: (l.tenant_name || "").trim() || null,
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

  const extraCols = statement?.extra_charges?.length ? statement.extra_charges : [];

  function extraOnLine(line: BillingLine, index: number) {
    if (line.occupancy === "vacant") return 0;
    const list = line.extra_charges?.length ? line.extra_charges : extraCols;
    return Number(list[index]?.amount) || 0;
  }

  function extrasNamed(line: BillingLine) {
    if (line.occupancy === "vacant") return "—";
    const list = line.extra_charges || [];
    if (!list.length) return "—";
    return list.map((c) => `${c.label} ${money(c.amount)}`).join(" · ");
  }

  function handleDownloadPdf() {
    if (!liveLines.length) return;
    const extraHeaders = extraCols.map((c) => c.label);
    const headers = [
      "House",
      "Tenant",
      "Prev. meter",
      "Curr. meter",
      "Units",
      "Water",
      "Garbage",
      "Rent",
      ...extraHeaders,
      "Arrears",
      "Total",
      "Paid",
      "Balance",
    ];
    const rows: Array<Array<string | number>> = liveLines.map((l) => {
      const house = `${l.unit_number}${l.occupancy === "vacant" ? " (vacant)" : ""}`;
      return [
        house,
        l.tenant_name ?? "",
        money(toNum(l.previous_reading as number | string)),
        money(toNum(l.current_reading as number | string)),
        money(l.water_units),
        money(l.water_cost),
        money(l.garbage_fee),
        money(l.rent_amount),
        ...extraCols.map((_, i) => money(extraOnLine(l, i))),
        money(l.arrears || 0),
        money(l.total_due),
        money(toNum(l.amount_paid as number | string)),
        money(l.balance),
      ];
    });
    rows.push([
      "Totals",
      "",
      "",
      "",
      money(totals.water_units || 0),
      money(totals.water_cost || 0),
      money(totals.garbage_fee || 0),
      money(totals.rent_amount || 0),
      ...extraCols.map((_, i) => money(liveLines.reduce((s, l) => s + extraOnLine(l, i), 0))),
      money(totals.arrears || 0),
      money(totals.total_due || 0),
      money(totals.amount_paid || 0),
      money(totals.balance || 0),
    ]);
    void downloadPdfTable(
      statementFileName(statement?.property_name || "Listing", period),
      statement?.property_name || "Billing",
      asAtMonthLabel(period),
      headers,
      rows,
    ).catch((e) => setError(e instanceof Error ? e.message : "Could not download PDF"));
  }

  async function loadHistory() {
    const token = getToken();
    if (!token) return;
    setHistoryBusy(true);
    setError("");
    try {
      const data = await billing.history(propertyId, historyFrom, historyTo, token);
      setHistoryLines(data.lines);
      setHistoryName(data.property_name || statement?.property_name || "");
      if (!data.lines.length) {
        setSuccess("No saved months in that range. Save a month first, then search history.");
      } else {
        setSuccess(`Showing ${data.lines.length} saved row(s) from ${data.from} to ${data.to}.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load history");
      setHistoryLines([]);
    } finally {
      setHistoryBusy(false);
    }
  }

  function handleDownloadHistoryPdf() {
    if (!historyLines.length) return;
    const headers = [
      "Period",
      "House",
      "Tenant",
      "Charges",
      "Arrears",
      "Total",
      "Paid",
      "Balance",
    ];
    const rows = historyLines.map((l) => [
      l.period,
      `${l.unit_number}${l.occupancy === "vacant" ? " (vacant)" : ""}`,
      l.tenant_name ?? "",
      extrasNamed(l),
      money(l.arrears || 0),
      money(l.total_due),
      money(l.amount_paid),
      money(l.balance),
    ]);
    void downloadPdfTable(
      statementFileName(historyName || statement?.property_name || "Listing", historyTo),
      historyName || statement?.property_name || "Billing",
      asAtMonthLabel(historyTo),
      headers,
      rows,
    ).catch((e) => setError(e instanceof Error ? e.message : "Could not download PDF"));
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
            onClick={handleDownloadPdf}
            disabled={liveLines.length === 0}
            className="rounded-lg bg-mt-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Download PDF
          </button>
        </div>
      </div>

      {statement && (
        <div className="rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-100 print:shadow-none">
          Water rate: <strong>KSh {money(statement.water_rate_per_unit)}</strong>/unit · Garbage:{" "}
          <strong>KSh {money(statement.garbage_fee)}</strong>/unit
          {(statement.extra_charges || []).length > 0 ? (
            <>
              {" "}
              ·{" "}
              <strong>
                {(statement.extra_charges || []).map((c) => `${c.label} KSh ${money(c.amount)}`).join(" · ")}
              </strong>
            </>
          ) : null}{" "}
          · Period: <strong>{period}</strong>
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
              {extraCols.map((c, i) => (
                <th key={`${c.label}-${i}`} className="px-3 py-3">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-3">Arrears</th>
              <th className="px-3 py-3">Total</th>
              <th className="px-3 py-3">Paid</th>
              <th className="px-3 py-3">Balance</th>
            </tr>
          </thead>
          <tbody>
            {liveLines.map((l) => (
              <tr key={l.unit_id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold">
                  {l.unit_number}
                  {l.occupancy === "vacant" ? (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vacant</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={l.tenant_name ?? ""}
                    onChange={(e) => updateLine(l.unit_id, "tenant_name", e.target.value)}
                    placeholder="Tenant name"
                    className="w-36 rounded border border-slate-200 px-2 py-1 print:border-0"
                  />
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
                {extraCols.map((c, i) => (
                  <td key={`${l.unit_id}-${c.label}-${i}`} className="px-3 py-2">
                    {money(extraOnLine(l, i))}
                  </td>
                ))}
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
              {extraCols.map((c, i) => (
                <td key={`total-${c.label}-${i}`} className="px-3 py-3">
                  {money(liveLines.reduce((s, l) => s + extraOnLine(l, i), 0))}
                </td>
              ))}
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

      <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 print:hidden">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Saved history</h2>
          <p className="text-xs text-slate-500">
            Choose a month range to see saved bills, including vacant-house arrears. Open a month to record a later payment, then Save.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-slate-600">
            From
            <input
              type="month"
              value={historyFrom}
              onChange={(e) => setHistoryFrom(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            To
            <input
              type="month"
              value={historyTo}
              onChange={(e) => setHistoryTo(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={loadHistory}
            disabled={historyBusy}
            className="rounded-lg bg-mt-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {historyBusy ? "Loading…" : "Show history"}
          </button>
          <button
            type="button"
            onClick={handleDownloadHistoryPdf}
            disabled={historyLines.length === 0}
            className="rounded-lg bg-mt-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Download PDF
          </button>
        </div>
        {historyLines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Unit / house no.</th>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Charges</th>
                  <th className="px-3 py-2">Arrears</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Paid</th>
                  <th className="px-3 py-2">Balance</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {historyLines.map((l) => (
                  <tr key={`${l.period}-${l.unit_id}`} className="border-t border-slate-100">
                    <td className="px-3 py-2">{l.period}</td>
                    <td className="px-3 py-2 font-semibold">
                      {l.unit_number}
                      {l.occupancy === "vacant" ? (
                        <span className="ml-2 text-[10px] font-semibold uppercase text-slate-400">Vacant</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{l.tenant_name || "—"}</td>
                    <td className="px-3 py-2">{extrasNamed(l)}</td>
                    <td className="px-3 py-2">{money(l.arrears || 0)}</td>
                    <td className="px-3 py-2">{money(l.total_due)}</td>
                    <td className="px-3 py-2">{money(l.amount_paid)}</td>
                    <td className={`px-3 py-2 font-semibold ${l.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                      {money(l.balance)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setPeriod(l.period.slice(0, 7))}
                        className="text-xs font-semibold text-mt-blue hover:underline"
                      >
                        Open month
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
