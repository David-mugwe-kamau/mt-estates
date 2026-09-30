import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Logo = { data: string; w: number; h: number };

async function loadLogoJpeg(): Promise<Logo | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("logo"));
      el.src = "/images/mt-estates-logo.png";
    });
    const w = Math.min(480, img.naturalWidth || 240);
    const h = Math.round((w * (img.naturalHeight || 1)) / Math.max(1, img.naturalWidth || 1));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { data: canvas.toDataURL("image/jpeg", 0.9), w, h };
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
  const logo = await loadLogoJpeg();
  const name = (listingName || "Statement").trim();
  const side = 12;
  const headerH = 40;
  const file = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

  const paintHeader = () => {
    doc.setFillColor(0, 91, 142);
    doc.rect(0, 0, pageW, 6, "F");
    let textX = side;
    if (logo) {
      const logoW = 22;
      const logoH = logoW * (logo.h / logo.w);
      try {
        doc.addImage(logo.data, "JPEG", side, 10, logoW, logoH);
      } catch {
        // keep the typed letterhead if the image cannot embed
      }
      textX = side + logoW + 5;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 91, 142);
    doc.text("MT ESTATES", textX, 14);
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(name, textX, 21, { maxWidth: pageW - textX - side });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    if (asAt) doc.text(asAt, textX, 28);
    doc.setDrawColor(0, 91, 142);
    doc.setLineWidth(0.45);
    doc.line(side, 34, pageW - side, 34);
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
