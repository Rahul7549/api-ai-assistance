import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(__dirname, "../../generated/pdfs");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export interface PdfResult {
  fileName: string;
  url: string;
  pageCount: number;
  fileSize: string;
}

const F = {
  normal: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
  boldItalic: "Helvetica-BoldOblique",
  mono: "Courier",
  monoBold: "Courier-Bold",
};

const C = {
  primary: "#1e293b",
  heading: "#0f172a",
  body: "#334155",
  muted: "#94a3b8",
  accent: "#4f46e5",
  accentLight: "#e0e7ff",
  accentSoft: "#818cf8",
  codeBg: "#f8fafc",
  codeBorder: "#e2e8f0",
  quoteBorder: "#6366f1",
  quoteText: "#475569",
  quoteBg: "#f5f3ff",
  rule: "#cbd5e1",
  banner: "#4f46e5",
  bannerText: "#ffffff",
  white: "#ffffff",
  bulletDot: "#6366f1",
};

const MARGIN = { left: 60, right: 60, top: 60, bottom: 70 };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#{1,3}\s+(.+)$/m);
  if (match) return match[1].trim();
  const cleaned = fallback.replace(/pdf|generate|create|make|write|can you|please|me|a|file|with/gi, "").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1) || "Document";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

interface Seg {
  text: string;
  font: string;
  color?: string;
}

function parseInline(text: string, baseFont = F.normal): Seg[] {
  const segs: Seg[] = [];
  const pat = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pat.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index), font: baseFont });
    if (m[2]) segs.push({ text: m[2], font: F.boldItalic });
    else if (m[3]) segs.push({ text: m[3], font: F.bold, color: C.heading });
    else if (m[4]) segs.push({ text: m[4], font: F.italic });
    else if (m[5]) segs.push({ text: m[5], font: F.mono, color: C.accent });
    last = m.index + m[0].length;
  }

  if (last < text.length) segs.push({ text: text.slice(last), font: baseFont });
  return segs.length ? segs : [{ text, font: baseFont }];
}

function contentWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - MARGIN.left - MARGIN.right;
}

function richText(doc: PDFKit.PDFDocument, text: string, opts: { size: number; color: string; x?: number; baseFont?: string; lineGap?: number }) {
  const segs = parseInline(text, opts.baseFont);
  const x = opts.x ?? MARGIN.left;
  const w = doc.page.width - x - MARGIN.right;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    doc
      .font(s.font)
      .fontSize(opts.size)
      .fillColor(s.color ?? opts.color)
      .text(s.text, x, undefined, { continued: i < segs.length - 1, width: w, lineGap: opts.lineGap ?? 5 });
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - MARGIN.bottom) {
    doc.addPage();
  }
}

// ── Header banner ──────────────────────────────────────

function renderHeader(doc: PDFKit.PDFDocument, title: string) {
  const pw = doc.page.width;
  const bannerH = 100;

  // Full-width gradient banner
  doc.save();
  doc.rect(0, 0, pw, bannerH).fill(C.banner);

  // Subtle diagonal accent stripe
  doc.save();
  doc.opacity(0.08);
  doc.rect(pw - 180, 0, 180, bannerH).fill(C.white);
  doc.restore();

  // Title on banner
  doc
    .font(F.bold)
    .fontSize(22)
    .fillColor(C.bannerText)
    .text(title, MARGIN.left, 30, { width: pw - MARGIN.left - MARGIN.right - 40 });

  // Date + branding line
  doc
    .font(F.normal)
    .fontSize(8.5)
    .fillColor("rgba(255,255,255,0.7)")
    .text(`Generated on ${formatDate()}  •  AuraAI`, MARGIN.left, bannerH - 22);

  doc.restore();

  // Thin accent line below banner
  doc
    .moveTo(MARGIN.left, bannerH + 3)
    .lineTo(pw - MARGIN.right, bannerH + 3)
    .strokeColor(C.accentLight)
    .lineWidth(1.5)
    .stroke();

  doc.y = bannerH + 28;
}

// ── Code block ─────────────────────────────────────────

function renderCode(doc: PDFKit.PDFDocument, code: string, lang?: string) {
  doc.moveDown(0.4);
  const x = MARGIN.left;
  const w = contentWidth(doc);

  const textH = doc.font(F.mono).fontSize(8.5).heightOfString(code, { width: w - 24, lineGap: 3 });
  const blockH = textH + 20 + (lang ? 16 : 0);

  ensureSpace(doc, blockH + 10);

  const y0 = doc.y;
  doc.save();

  // Background
  doc.roundedRect(x, y0, w, blockH, 5).fill(C.codeBg);

  // Left accent bar
  doc.rect(x, y0, 4, blockH).fill(C.accent);

  // Border
  doc.roundedRect(x, y0, w, blockH, 5).strokeColor(C.codeBorder).lineWidth(0.5).stroke();

  doc.restore();

  let textY = y0 + 10;

  // Language label
  if (lang) {
    doc
      .font(F.monoBold)
      .fontSize(7)
      .fillColor(C.accentSoft)
      .text(lang.toUpperCase(), x + 14, textY);
    textY += 14;
  }

  doc
    .font(F.mono)
    .fontSize(8.5)
    .fillColor(C.primary)
    .text(code, x + 14, textY, { width: w - 24, lineGap: 3 });

  doc.y = y0 + blockH + 6;
  doc.moveDown(0.3);
}

// ── Blockquote ─────────────────────────────────────────

function renderBlockquote(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.2);
  const x = MARGIN.left;
  const w = contentWidth(doc);
  const innerX = x + 18;
  const innerW = w - 18;

  const textH = doc.font(F.italic).fontSize(10.5).heightOfString(text, { width: innerW - 14, lineGap: 4 });
  const blockH = textH + 16;

  ensureSpace(doc, blockH + 6);

  const y0 = doc.y;
  doc.save();
  doc.roundedRect(x, y0, w, blockH, 4).fill(C.quoteBg);
  doc.rect(x, y0 + 2, 4, blockH - 4).fill(C.quoteBorder);
  doc.restore();

  doc
    .font(F.italic)
    .fontSize(10.5)
    .fillColor(C.quoteText)
    .text(text, innerX + 6, y0 + 8, { width: innerW - 14, lineGap: 4 });

  doc.y = y0 + blockH + 4;
  doc.moveDown(0.2);
}

// ── Main render ────────────────────────────────────────

function renderMarkdown(doc: PDFKit.PDFDocument, content: string, title: string) {
  renderHeader(doc, title);

  const lines = content.split("\n");
  let inCode = false;
  let codeBuf: string[] = [];
  let codeLang: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    // Code fence
    if (trimmed.startsWith("```")) {
      if (inCode) {
        renderCode(doc, codeBuf.join("\n"), codeLang);
        codeBuf = [];
        codeLang = undefined;
        inCode = false;
      } else {
        inCode = true;
        codeLang = trimmed.slice(3).trim() || undefined;
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    // Empty line
    if (!trimmed) { doc.moveDown(0.35); continue; }

    // ── Headings ──

    if (trimmed.startsWith("# ")) {
      ensureSpace(doc, 50);
      doc.moveDown(1);
      doc
        .font(F.bold)
        .fontSize(20)
        .fillColor(C.heading)
        .text(trimmed.slice(2), MARGIN.left, undefined, { width: contentWidth(doc) });
      // Underline
      doc.moveDown(0.15);
      doc
        .moveTo(MARGIN.left, doc.y)
        .lineTo(MARGIN.left + contentWidth(doc), doc.y)
        .strokeColor(C.accent)
        .lineWidth(1.5)
        .stroke();
      doc.moveDown(0.5);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      ensureSpace(doc, 40);
      doc.moveDown(0.8);
      doc
        .font(F.bold)
        .fontSize(15)
        .fillColor(C.accent)
        .text(trimmed.slice(3), MARGIN.left, undefined, { width: contentWidth(doc) });
      doc.moveDown(0.3);
      continue;
    }

    if (trimmed.startsWith("### ")) {
      ensureSpace(doc, 35);
      doc.moveDown(0.6);
      doc
        .font(F.bold)
        .fontSize(12.5)
        .fillColor(C.heading)
        .text(trimmed.slice(4), MARGIN.left, undefined, { width: contentWidth(doc) });
      doc.moveDown(0.2);
      continue;
    }

    if (trimmed.startsWith("#### ")) {
      ensureSpace(doc, 30);
      doc.moveDown(0.5);
      doc
        .font(F.boldItalic)
        .fontSize(11)
        .fillColor(C.primary)
        .text(trimmed.slice(5), MARGIN.left, undefined, { width: contentWidth(doc) });
      doc.moveDown(0.15);
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      doc.moveDown(0.6);
      const cx = doc.page.width / 2;
      doc.save().opacity(0.35);
      doc.moveTo(cx - 60, doc.y).lineTo(cx + 60, doc.y).strokeColor(C.rule).lineWidth(0.5).stroke();
      // Decorative dots
      doc.circle(cx - 4, doc.y, 1.2).fill(C.rule);
      doc.circle(cx + 4, doc.y, 1.2).fill(C.rule);
      doc.restore();
      doc.moveDown(0.6);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      renderBlockquote(doc, trimmed.slice(2));
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(trimmed)) {
      ensureSpace(doc, 20);
      const text = trimmed.replace(/^[-*+]\s/, "");
      const bulletX = MARGIN.left + 8;
      const textX = MARGIN.left + 22;
      doc.circle(bulletX, doc.y + 6, 2.5).fill(C.bulletDot);
      richText(doc, text, { size: 10.5, color: C.body, x: textX, lineGap: 4 });
      doc.moveDown(0.2);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)[.)]\s(.+)/);
    if (olMatch) {
      ensureSpace(doc, 20);
      const numX = MARGIN.left + 4;
      const textX = MARGIN.left + 22;
      doc
        .font(F.bold)
        .fontSize(10)
        .fillColor(C.accent)
        .text(`${olMatch[1]}.`, numX, doc.y, { continued: false });
      doc.moveUp();
      richText(doc, olMatch[2], { size: 10.5, color: C.body, x: textX, lineGap: 4 });
      doc.moveDown(0.2);
      continue;
    }

    // Regular paragraph
    ensureSpace(doc, 20);
    richText(doc, trimmed, { size: 10.5, color: C.body, lineGap: 5 });
    doc.moveDown(0.35);
  }

  // Flush unclosed code block
  if (inCode && codeBuf.length) {
    renderCode(doc, codeBuf.join("\n"), codeLang);
  }
}

// ── Footer ─────────────────────────────────────────────

function renderFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  const pw = doc.page.width;

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    // Top-of-page thin line (skip first page — it has the banner)
    if (i > 0) {
      doc
        .moveTo(MARGIN.left, MARGIN.top - 10)
        .lineTo(pw - MARGIN.right, MARGIN.top - 10)
        .strokeColor(C.accentLight)
        .lineWidth(0.5)
        .stroke();
    }

    // Footer line
    const footerY = doc.page.height - 45;
    doc
      .moveTo(MARGIN.left, footerY)
      .lineTo(pw - MARGIN.right, footerY)
      .strokeColor(C.codeBorder)
      .lineWidth(0.5)
      .stroke();

    // Footer left: branding
    doc
      .font(F.normal)
      .fontSize(7.5)
      .fillColor(C.muted)
      .text("Generated by AuraAI", MARGIN.left, footerY + 8);

    // Footer right: page number
    const pageText = `Page ${i + 1} of ${range.count}`;
    const pageW = doc.widthOfString(pageText);
    doc
      .font(F.normal)
      .fontSize(7.5)
      .fillColor(C.muted)
      .text(pageText, pw - MARGIN.right - pageW, footerY + 8);
  }
}

// ── Public API ─────────────────────────────────────────

const PDF_KEYWORDS = [
  "pdf",
  "generate a document",
  "create a document",
  "make a document",
  "write a document",
  "generate a file",
  "create a file",
  "download",
  "export",
  "printable",
];

export function detectPdfIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return PDF_KEYWORDS.some((kw) => lower.includes(kw));
}

export function generatePdf(content: string, userMessage: string): Promise<PdfResult> {
  return new Promise((resolve, reject) => {
    const title = extractTitle(content, userMessage);
    const timestamp = Date.now();
    const safeName = title
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 40);
    const fileName = `${safeName}-${timestamp}.pdf`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    const doc = new PDFDocument({
      margins: { top: MARGIN.top, bottom: MARGIN.bottom, left: MARGIN.left, right: MARGIN.right },
      size: "A4",
      info: {
        Title: title,
        Author: "AuraAI",
        Creator: "AuraAI Document Generator",
        Subject: title,
      },
      bufferPages: true,
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    renderMarkdown(doc, content, title);
    renderFooters(doc);

    doc.end();

    stream.on("finish", () => {
      const stats = fs.statSync(filePath);
      const range = doc.bufferedPageRange();
      resolve({
        fileName,
        url: `/api/pdf/download/${fileName}`,
        pageCount: range.start + range.count,
        fileSize: formatFileSize(stats.size),
      });
    });

    stream.on("error", reject);
  });
}
