import { getToken } from "@/lib/auth";
import { saveAsFile } from "@/lib/saveAsFile";

export function asAtMonthLabel(period: string) {
  const p = String(period || "").slice(0, 7);
  const m = p.match(/^(\d{4})-(\d{2})$/);
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const last = new Date(year, month, 0).getDate();
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const v = last % 100;
  const suf = ["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th";
  return `as at ${last}${suf} ${names[month - 1]} ${year}`;
}

export async function downloadPdfTable(
  filename: string,
  listingName: string,
  asAt: string,
  headers: string[],
  rows: Array<Array<string | number>>,
) {
  const token = getToken();
  const file = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  const res = await fetch("/api/v1/billing/pdf", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token && token !== "cookie" ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ filename: file, listingName, asAt, headers, rows }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Could not download PDF" }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Could not download PDF");
  }
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (header !== "%PDF") {
    throw new Error("The statement file was not a valid PDF. Please try again.");
  }
  saveAsFile(buf, file, "application/pdf");
}
