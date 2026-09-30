import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

async function loadLogoJpeg(): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("logo"));
      el.src = "/images/mt-estates-logo.png";
    });
    const w = Math.min(400, img.naturalWidth || 200);
    const h = Math.round((w * (img.naturalHeight || 1)) / Math.max(1, img.naturalWidth || 1));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
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
  });
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await loadLogoJpeg();
  const name = (listingName || "Billing").trim();
  const headerTop = logo ? 30 : 18;
  const file = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

  const paintBranding = () => {
    if (logo) {
      try {
        doc.addImage(logo, "JPEG", (pageW - 20) / 2, 5, 20, 10);
      } catch {
        // text header still prints if the logo cannot be embedded
      }
    }
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(name, 8, logo ? 22 : 12, { maxWidth: pageW - 16 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (asAt) doc.text(asAt, 8, logo ? 27 : 17);
  };

  const colCount = Math.max(1, headers.length);
  const tableW = Math.min(pageW - 12, Math.max(120, colCount * 14));

  autoTable(doc, {
    head: [headers.map((h) => String(h))],
    body: rows.map((row) => row.map((c) => String(c ?? ""))),
    startY: headerTop,
    tableWidth: tableW,
    margin: { top: headerTop, left: 6, right: 6, bottom: 8 },
    styles: {
      font: "helvetica",
      fontSize: landscape ? 7 : 8,
      cellPadding: 1,
      overflow: "linebreak",
      valign: "middle",
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [0, 91, 142],
      textColor: 255,
      fontStyle: "bold",
    },
    didDrawPage: () => {
      paintBranding();
    },
  });

  doc.save(file);
}
