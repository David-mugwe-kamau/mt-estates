import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAsFile } from "@/lib/saveAsFile";

async function loadLogo(): Promise<{ header: string; watermark: string; w: number; h: number } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("logo"));
      el.src = "/images/mt-estates-logo.png";
    });
    const w = Math.min(800, img.naturalWidth || 400);
    const h = Math.round((w * (img.naturalHeight || 1)) / Math.max(1, img.naturalWidth || 1));
    const header = document.createElement("canvas");
    header.width = w;
    header.height = h;
    const hctx = header.getContext("2d");
    if (!hctx) return null;
    hctx.drawImage(img, 0, 0, w, h);
    const mark = document.createElement("canvas");
    mark.width = w;
    mark.height = h;
    const mctx = mark.getContext("2d");
    if (!mctx) return null;
    mctx.globalAlpha = 0.1;
    mctx.drawImage(img, 0, 0, w, h);
    return {
      header: header.toDataURL("image/png"),
      watermark: mark.toDataURL("image/png"),
      w,
      h,
    };
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
  const pageH = doc.internal.pageSize.getHeight();
  const logo = await loadLogo();
  const name = (listingName || "Billing").trim();

  const paintBranding = () => {
    if (logo) {
      const ratio = logo.h / logo.w;
      const wmW = Math.min(110, pageW * 0.45);
      const wmH = wmW * ratio;
      doc.addImage(logo.watermark, "PNG", (pageW - wmW) / 2, (pageH - wmH) / 2, wmW, wmH);
      const hdW = 28;
      const hdH = hdW * ratio;
      doc.addImage(logo.header, "PNG", (pageW - hdW) / 2, 8, hdW, hdH);
    }
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(name, 14, logo ? 32 : 18, { maxWidth: pageW - 28 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    if (asAt) doc.text(asAt, 14, logo ? 40 : 26);
  };

  autoTable(doc, {
    head: [headers.map((h) => String(h))],
    body: rows.map((row) => row.map((c) => String(c ?? ""))),
    startY: logo ? 46 : 32,
    margin: { top: logo ? 46 : 32, left: 10, right: 10, bottom: 12 },
    styles: {
      font: "helvetica",
      fontSize: landscape ? 7 : 8,
      cellPadding: 1.4,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [0, 91, 142],
      textColor: 255,
      fontStyle: "bold",
      fontSize: landscape ? 7 : 8,
    },
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
