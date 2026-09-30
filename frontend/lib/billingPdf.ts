import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Logo = { data: string; w: number; h: number };

async function loadLogoPng(): Promise<Logo | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("logo"));
      el.src = `${window.location.origin}/images/mt-estates-logo.png`;
    });
    const src = document.createElement("canvas");
    src.width = img.naturalWidth || 1;
    src.height = img.naturalHeight || 1;
    const sctx = src.getContext("2d");
    if (!sctx) return null;
    sctx.drawImage(img, 0, 0);
    const pix = sctx.getImageData(0, 0, src.width, src.height).data;
    let minX = src.width;
    let minY = src.height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const i = (y * src.width + x) * 4;
        const a = pix[i + 3];
        const white = pix[i] > 245 && pix[i + 1] > 245 && pix[i + 2] > 245;
        if (a > 12 && !white) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    const pad = 8;
    if (maxX <= minX || maxY <= minY) {
      minX = 0;
      minY = 0;
      maxX = src.width - 1;
      maxY = src.height - 1;
    }
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(src.width - 1, maxX + pad);
    maxY = Math.min(src.height - 1, maxY + pad);
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const cropped = document.createElement("canvas");
    cropped.width = cw;
    cropped.height = ch;
    const cctx = cropped.getContext("2d");
    if (!cctx) return null;
    cctx.drawImage(src, minX, minY, cw, ch, 0, 0, cw, ch);
    return { data: cropped.toDataURL("image/png"), w: cw, h: ch };
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
  const landscape = headers.length > 11;
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logo = await loadLogoPng();
  const name = (listingName || "Statement").trim();
  const side = 12;
  const logoW = 36;
  const logoH = logo ? logoW * (logo.h / logo.w) : 0;
  const headerH = logo ? Math.ceil(10 + logoH + 22) : 32;
  const file = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

  const paintHeader = () => {
    doc.setFillColor(0, 91, 142);
    doc.rect(0, 0, pageW, 4, "F");
    let y = 8;
    if (logo) {
      try {
        doc.addImage(logo.data, "PNG", (pageW - logoW) / 2, y, logoW, logoH);
      } catch {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(0, 91, 142);
        doc.text("MT ESTATES", pageW / 2, y + 8, { align: "center" });
      }
      y += logoH + 6;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(name, pageW / 2, y, { align: "center", maxWidth: pageW - side * 2 });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    if (asAt) doc.text(asAt, pageW / 2, y, { align: "center" });
    doc.setDrawColor(0, 91, 142);
    doc.setLineWidth(0.45);
    doc.line(side, headerH - 4, pageW - side, headerH - 4);
  };

  const paintFooter = (page: number) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(side, pageH - 12, pageW - side, pageH - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("MT Estates  ·  Monthly statement", side, pageH - 7);
    doc.text(`Page ${page}`, pageW - side, pageH - 7, { align: "right" });
  };

  const columnStyles: Record<number, { halign: "left" | "right"; cellWidth?: number }> = {
    0: { halign: "left", cellWidth: landscape ? 22 : 20 },
    1: { halign: "left", cellWidth: landscape ? 32 : 28 },
  };
  headers.forEach((_, i) => {
    if (i >= 2) columnStyles[i] = { halign: "right" };
  });

  autoTable(doc, {
    head: [headers.map((h) => String(h))],
    body: rows.map((row) => row.map((c) => String(c ?? ""))),
    startY: headerH,
    margin: { top: headerH, left: side, right: side, bottom: 16 },
    tableWidth: "auto",
    styles: {
      font: "helvetica",
      fontSize: landscape ? 7.5 : 8,
      cellPadding: { top: 1.6, bottom: 1.6, left: 1.4, right: 1.4 },
      overflow: "linebreak",
      valign: "middle",
      lineWidth: 0.12,
      lineColor: [203, 213, 225],
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [0, 91, 142],
      textColor: 255,
      fontStyle: "bold",
      fontSize: landscape ? 7 : 7.5,
      halign: "center",
      cellPadding: { top: 2, bottom: 2, left: 1.2, right: 1.2 },
    },
    bodyStyles: {
      minCellHeight: 7,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles,
    willDrawPage: () => {
      paintHeader();
    },
    didDrawPage: (ctx) => {
      paintFooter(ctx.pageNumber);
    },
  });

  doc.save(file);
}
