import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";

const BLUE = rgb(0, 91 / 255, 142 / 255);
const INK = rgb(15 / 255, 23 / 255, 42 / 255);
const MUTED = rgb(71 / 255, 85 / 255, 105 / 255);
const LINE = rgb(203 / 255, 213 / 255, 225 / 255);
const HEAD_TEXT = rgb(1, 1, 1);
const ZEBRA = rgb(248 / 255, 250 / 255, 252 / 255);
const WHITE = rgb(1, 1, 1);

function winAnsi(s: string) {
  return Array.from(String(s ?? ""))
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c >= 32 && c <= 126) return ch;
      if (c === 9) return " ";
      return "?";
    })
    .join("");
}

function wrap(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const raw = winAnsi(text).replace(/\s+/g, " ").trim() || " ";
  const words = raw.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxW) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export async function buildStatementPdf(input: {
  listingName: string;
  asAt: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}): Promise<Uint8Array> {
  const headers = (input.headers || []).map((h) => winAnsi(h));
  const rows = (input.rows || []).map((r) => r.map((c) => winAnsi(String(c ?? ""))));
  const cols = Math.max(1, headers.length);
  const landscape = cols > 11;
  const pageW = landscape ? 841.89 : 595.28;
  const pageH = landscape ? 595.28 : 841.89;
  const margin = 36;
  const fontSize = landscape ? 7 : 8;
  const headSize = landscape ? 7 : 8;
  const lineH = fontSize + 4;
  const usable = pageW - margin * 2;
  const colW = headers.map((_, i) => {
    if (cols === 1) return usable;
    if (i === 0) return usable * 0.12;
    if (i === 1) return usable * 0.16;
    return (usable * 0.72) / Math.max(1, cols - 2);
  });

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let logo: PDFImage | null = null;
  try {
    const logoBytes = await readFile(path.join(process.cwd(), "public", "images", "mt-estates-logo.png"));
    logo = await doc.embedPng(logoBytes);
  } catch {
    logo = null;
  }

  const logoDrawW = 110;
  const logoDrawH = logo ? (logoDrawW * logo.height) / logo.width : 0;
  const headerBlock = logo ? 24 + logoDrawH + 40 : 58;

  const drawHeader = (page: PDFPage) => {
    page.drawRectangle({ x: 0, y: pageH - 12, width: pageW, height: 12, color: BLUE });
    let yTop = pageH - 26;
    if (logo) {
      page.drawImage(logo, {
        x: (pageW - logoDrawW) / 2,
        y: yTop - logoDrawH,
        width: logoDrawW,
        height: logoDrawH,
      });
      yTop -= logoDrawH + 12;
    }
    const title = winAnsi((input.listingName || "Statement").trim());
    const titleSize = 13;
    const tw = fontBold.widthOfTextAtSize(title, titleSize);
    page.drawText(title, {
      x: Math.max(margin, (pageW - tw) / 2),
      y: yTop - 12,
      size: titleSize,
      font: fontBold,
      color: INK,
    });
    if (input.asAt) {
      const asAt = winAnsi(input.asAt);
      const aw = font.widthOfTextAtSize(asAt, 10);
      page.drawText(asAt, {
        x: Math.max(margin, (pageW - aw) / 2),
        y: yTop - 26,
        size: 10,
        font,
        color: MUTED,
      });
    }
    page.drawRectangle({
      x: margin,
      y: pageH - headerBlock + 8,
      width: usable,
      height: 1.5,
      color: BLUE,
    });
  };

  const drawFooter = (page: PDFPage, pageNo: number, pages: number) => {
    page.drawRectangle({ x: margin, y: 28, width: usable, height: 0.8, color: LINE });
    page.drawText("MT Estates  |  Monthly statement", {
      x: margin,
      y: 16,
      size: 8,
      font,
      color: MUTED,
    });
    const label = `Page ${pageNo} of ${pages}`;
    page.drawText(label, {
      x: pageW - margin - font.widthOfTextAtSize(label, 8),
      y: 16,
      size: 8,
      font,
      color: MUTED,
    });
  };

  const tableTop = pageH - headerBlock - 6;
  const bottom = 44;

  const headerLines = headers.map((h, i) => wrap(fontBold, h, headSize, Math.max(18, colW[i] - 8)));
  const bodyLines = rows.map((row) =>
    row.map((cell, i) => wrap(font, cell, fontSize, Math.max(18, colW[i] - 8))),
  );

  const rowHeight = (lines: string[][]) => {
    const n = Math.max(1, ...lines.map((l) => l.length));
    return n * lineH + 8;
  };

  const chunks: { kind: "head" | "body"; idx?: number }[][] = [];
  let current: { kind: "head" | "body"; idx?: number }[] = [{ kind: "head" }];
  let yCursor = tableTop - rowHeight(headerLines);

  bodyLines.forEach((_, idx) => {
    const h = rowHeight(bodyLines[idx]);
    if (yCursor - h < bottom) {
      chunks.push(current);
      current = [{ kind: "head" }];
      yCursor = tableTop - rowHeight(headerLines);
    }
    current.push({ kind: "body", idx });
    yCursor -= h;
  });
  chunks.push(current);

  const pdfPages: PDFPage[] = [];
  for (const chunk of chunks) {
    const page = doc.addPage([pageW, pageH]);
    pdfPages.push(page);
    drawHeader(page);
    let y = tableTop;
    for (const item of chunk) {
      const lines = item.kind === "head" ? headerLines : bodyLines[item.idx!];
      const h = rowHeight(lines);
      const isHead = item.kind === "head";
      const zebra = !isHead && (item.idx || 0) % 2 === 1;
      page.drawRectangle({
        x: margin,
        y: y - h,
        width: usable,
        height: h,
        color: isHead ? BLUE : zebra ? ZEBRA : WHITE,
      });
      let x = margin;
      lines.forEach((cell, i) => {
        const right = i >= 2;
        const useFont = isHead ? fontBold : font;
        const size = isHead ? headSize : fontSize;
        const color = isHead ? HEAD_TEXT : INK;
        cell.forEach((ln, li) => {
          const tw = useFont.widthOfTextAtSize(ln, size);
          const tx = right ? x + colW[i] - 5 - tw : x + 4;
          page.drawText(ln, {
            x: Math.max(x + 2, tx),
            y: y - 11 - li * lineH,
            size,
            font: useFont,
            color,
          });
        });
        x += colW[i];
      });
      page.drawRectangle({ x: margin, y: y - h, width: usable, height: 0.5, color: LINE });
      y -= h;
    }
  }

  const total = pdfPages.length || 1;
  if (!pdfPages.length) {
    const page = doc.addPage([pageW, pageH]);
    drawHeader(page);
    drawFooter(page, 1, 1);
  } else {
    pdfPages.forEach((page, i) => drawFooter(page, i + 1, total));
  }

  return doc.save({ useObjectStreams: false });
}
