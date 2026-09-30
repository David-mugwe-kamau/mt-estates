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

function cellText(v: string | number, colW: number) {
  const s = String(v ?? "");
  const max = Math.max(6, Math.floor(colW / 4.2));
  return s.length > max ? `${s.slice(0, max - 1)}.` : s;
}

/** Landscape A4 table PDF. No extra npm packages. */
export function downloadPdfTable(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: Array<Array<string | number>>,
) {
  const pageW = 841.89;
  const pageH = 595.28;
  const margin = 28;
  const textSize = 7;
  const rowH = 14;
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
  function header(y: number) {
    line(margin, y + 10, pageW - margin, y + 10);
    headers.forEach((h, i) => text(margin + i * colW + 2, y, textSize, cellText(h, colW), true));
    line(margin, y + 10 - rowH, pageW - margin, y + 10 - rowH);
    return y - rowH;
  }
  function flush() {
    pageStreams.push(`0.25 w\n${ops.join("\n")}\n`);
    ops = [];
  }

  let y = pageH - margin;
  text(margin, y, 14, title, true);
  y -= 16;
  if (subtitle) {
    text(margin, y, 9, subtitle);
    y -= 16;
  }
  y -= 4;
  y = header(y);

  for (const row of rows) {
    if (y < margin + rowH) {
      flush();
      y = header(pageH - margin);
    }
    row.forEach((cell, i) => text(margin + i * colW + 2, y, textSize, cellText(cell, colW)));
    y -= rowH;
  }
  line(margin, y + 10, pageW - margin, y + 10);
  flush();

  const objs: string[] = [];
  const n = pageStreams.length;
  const font1 = 3;
  const font2 = 4;
  const firstContent = 5;
  const pageIds: number[] = [];
  for (let i = 0; i < n; i++) {
    const contentId = firstContent + i * 2;
    const pageId = contentId + 1;
    pageIds.push(pageId);
    const stream = pageStreams[i];
    objs[contentId] = `<< /Length ${stream.length} >> stream\n${stream}endstream`;
    objs[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contentId} 0 R >>`;
  }
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [ ${pageIds.map((id) => `${id} 0 R`).join(" ")} ] /Count ${n} >>`;
  objs[font1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objs[font2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  const maxId = firstContent + n * 2 - 1;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id <= maxId; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj ${objs[id]} endobj\n`;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
