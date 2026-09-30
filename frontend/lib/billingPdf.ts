import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAsFile } from "@/lib/saveAsFile";

async function loadLogo(): Promise<{ header: string; w: number; h: number } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("logo"));
      el.src = "/images/mt-estates-logo.png";
    });
    const w = Math.min(800, img.naturalWidth || 400);
    const h = Math.round((w * (img.naturalHeight || 1)) / Math.max(1, img.naturalWidth || 1));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return { header: canvas.toDataURL("image/png"), w, h };
  } catch {
    return null;
  }
}

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
  const landscape = headers.length > 10;
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await loadLogo();
  const name = (listingName || "Billing").trim();
  const headerTop = logo ? 28 : 16;

  const paintBranding = () => {
    if (logo) {
      const ratio = logo.h / logo.w;
      const hdW = 18;
      const hdH = hdW * ratio;
      doc.addImage(logo.header, "PNG", (pageW - hdW) / 2, 4, hdW, hdH);
    }
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(name, 8, logo ? 22 : 12, { maxWidth: pageW - 16 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (asAt) doc.text(asAt, 8, logo ? 27 : 17);
  };

  autoTable(doc, {
    head: [headers.map((h) => String(h))],
    body: rows.map((row) => row.map((c) => String(c ?? ""))),
    startY: headerTop,
    tableWidth: "wrap",
    margin: { top: headerTop, left: 6, right: 6, bottom: 8 },
    styles: {
      font: "helvetica",
      fontSize: landscape ? 6.5 : 7.5,
      cellPadding: { top: 0.7, bottom: 0.7, left: 1.1, right: 1.1 },
      overflow: "ellipsize",
      valign: "middle",
      halign: "left",
      lineWidth: 0.1,
      minCellHeight: 4.2,
      cellWidth: "auto",
    },
    headStyles: {
      fillColor: [0, 91, 142],
      textColor: 255,
      fontStyle: "bold",
      fontSize: landscape ? 6.5 : 7.5,
      cellPadding: { top: 0.8, bottom: 0.8, left: 1.1, right: 1.1 },
    },
    columnStyles: Object.fromEntries(
      headers.map((_, i) => [i, { cellWidth: "auto" }]),
    ),
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    willDrawPage: () => {
      paintBranding();
    },
  });

  const buf = doc.output("arraybuffer");
  saveAsFile(buf, filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
