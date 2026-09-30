function pdfEscape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function toPdfText(text: string) {
  return Array.from(String(text ?? ""))
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c >= 32 && c <= 126) return ch;
      if (c === 160) return " ";
      return "?";
    })
    .join("");
}

function strBytes(s: string) {
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff;
  return u;
}

function concat(parts: Uint8Array[]) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function jpegSize(bytes: Uint8Array): { w: number; h: number } | null {
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    i += 2 + len;
  }
  return null;
}

async function loadLogoJpeg(): Promise<{ bytes: Uint8Array; w: number; h: number } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("logo"));
      el.src = "/images/mt-estates-logo.png";
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(900, img.naturalWidth || 600);
    canvas.height = Math.round((canvas.width * (img.naturalHeight || 1)) / (img.naturalWidth || 1));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    const b64 = dataUrl.split(",")[1] || "";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const size = jpegSize(bytes);
    if (!size) return null;
    return { bytes, w: size.w, h: size.h };
  } catch {
    return null;
  }
}

function cellText(v: string | number, colW: number) {
  const s = String(v ?? "");
  const max = Math.max(8, Math.floor(colW / 4.4));
  return s.length > max ? `${s.slice(0, max - 1)}.` : s;
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
  const logo = await loadLogoJpeg();
  const landscape = headers.length > 10;
  const pageW = landscape ? 841.89 : 595.28;
  const pageH = landscape ? 595.28 : 841.89;
  const margin = 36;
  const textSize = 8;
  const rowH = 15;
  const usable = pageW - margin * 2;
  const colW = headers.length ? usable / headers.length : usable;

  const pageStreams: string[] = [];
  let ops: string[] = [];

  function text(x: number, y: number, size: number, value: string, bold = false) {
    ops.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(toPdfText(value))}) Tj ET`,
    );
  }
  function line(x1: number, y1: number, x2: number, y2: number) {
    ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  function drawLogos() {
    if (!logo) return;
    const wmW = Math.min(320, pageW * 0.42);
    const wmH = (wmW * logo.h) / logo.w;
    const wmX = (pageW - wmW) / 2;
    const wmY = (pageH - wmH) / 2;
    ops.push("q /GS1 gs");
    ops.push(`${wmW.toFixed(2)} 0 0 ${wmH.toFixed(2)} ${wmX.toFixed(2)} ${wmY.toFixed(2)} cm /Im1 Do Q`);
    const hdW = 88;
    const hdH = (hdW * logo.h) / logo.w;
    const hdX = (pageW - hdW) / 2;
    const hdY = pageH - margin - hdH + 6;
    ops.push("q /GS2 gs");
    ops.push(`${hdW.toFixed(2)} 0 0 ${hdH.toFixed(2)} ${hdX.toFixed(2)} ${hdY.toFixed(2)} cm /Im1 Do Q`);
  }

  function tableHeader(y: number) {
    line(margin, y + 11, pageW - margin, y + 11);
    headers.forEach((h, i) => text(margin + i * colW + 2, y, textSize, cellText(h, colW), true));
    line(margin, y + 11 - rowH, pageW - margin, y + 11 - rowH);
    return y - rowH;
  }

  function flush() {
    pageStreams.push(`0.4 w\n${ops.join("\n")}\n`);
    ops = [];
  }

  function startPage(first: boolean) {
    drawLogos();
    let y = pageH - margin - (logo ? 78 : 18);
    const name = listingName.trim() || "Billing";
    const nameSize = first ? 16 : 12;
    text(margin, y, nameSize, name, true);
    y -= first ? 20 : 16;
    if (asAt) {
      text(margin, y, first ? 11 : 9, asAt);
      y -= first ? 22 : 16;
    } else {
      y -= 8;
    }
    return tableHeader(y);
  }

  let y = startPage(true);
  for (const row of rows) {
    if (y < margin + rowH + 8) {
      flush();
      y = startPage(false);
    }
    row.forEach((cell, i) => text(margin + i * colW + 2, y, textSize, cellText(cell, colW)));
    y -= rowH;
  }
  line(margin, y + 11, pageW - margin, y + 11);
  flush();

  const n = pageStreams.length;
  const font1 = 3;
  const font2 = 4;
  const gsFaint = 5;
  const gsHeader = 6;
  const imgId = logo ? 7 : 0;
  const firstContent = logo ? 8 : 7;
  const objs: Array<string | Uint8Array> = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[font1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objs[font2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  objs[gsFaint] = "<< /Type /ExtGState /ca 0.07 /CA 0.07 >>";
  objs[gsHeader] = "<< /Type /ExtGState /ca 0.55 /CA 0.55 >>";
  if (logo) {
    const dict = `<< /Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >> stream\n`;
    objs[imgId] = concat([strBytes(dict), logo.bytes, strBytes("\nendstream")]);
  }

  const pageIds: number[] = [];
  const xobject = logo ? `/XObject << /Im1 ${imgId} 0 R >>` : "";
  for (let i = 0; i < n; i++) {
    const contentId = firstContent + i * 2;
    const pageId = contentId + 1;
    pageIds.push(pageId);
    const stream = pageStreams[i];
    objs[contentId] = `<< /Length ${stream.length} >> stream\n${stream}endstream`;
    objs[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> /ExtGState << /GS1 ${gsFaint} 0 R /GS2 ${gsHeader} 0 R >> ${xobject} >> /Contents ${contentId} 0 R >>`;
  }
  objs[2] = `<< /Type /Pages /Kids [ ${pageIds.map((id) => `${id} 0 R`).join(" ")} ] /Count ${n} >>`;

  const maxId = firstContent + n * 2 - 1;
  const parts: Uint8Array[] = [strBytes("%PDF-1.4\n")];
  let pos = parts[0].length;
  const offsets = [0];
  for (let id = 1; id <= maxId; id++) {
    offsets[id] = pos;
    const body = objs[id];
    const piece =
      typeof body === "string" || !body
        ? strBytes(`${id} 0 obj ${body || "<< >>"} endobj\n`)
        : concat([strBytes(`${id} 0 obj `), body, strBytes(" endobj\n")]);
    parts.push(piece);
    pos += piece.length;
  }
  const xrefPos = pos;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer << /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  parts.push(strBytes(xref));

  const blob = new Blob([concat(parts)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
