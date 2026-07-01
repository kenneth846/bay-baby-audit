import { NextResponse } from "next/server";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import heavyConnectInventory from "@/data/heavyconnect-reports/inventory.json";
import localPrimusSources from "@/data/primus-local/source-map.json";
import primusCrosswalk from "@/data/primusgfs/crosswalks/v3-2-to-v4-0.json";

type CrosswalkSummary = {
  strong_candidate?: number;
  review_candidate?: number;
  needs_manual_mapping?: number;
};

type PacketAnswer = {
  section: string;
  question: string;
  answer: string;
  evidenceMarked: boolean;
};

type PacketReport = {
  id: number;
  reportId: string;
  type: string;
  code: string;
  location: string;
  date: string;
  creator: string;
  status: string;
  sourceFile: string;
  evidenceTags: string[];
  details?: string;
  answerRows: PacketAnswer[];
  review?: {
    note: string;
    correctiveAction: string;
    reviewedAt: string;
    reviewer: string;
  };
};

type PacketRequest = {
  count: number;
  generatedBy: string;
  startDate: string;
  endDate: string;
  selectedIds: number[];
  reports: PacketReport[];
};

const pageSize: [number, number] = [612, 792];
const margin = 52;
const bottomMargin = 58;

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ").slice(0, 1200) : fallback;
}

function cleanShort(value: unknown, fallback = "") {
  return cleanText(value, fallback).slice(0, 160);
}

function parseStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => cleanShort(item)).filter(Boolean).slice(0, 20) : [];
}

function parseAnswers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 500).map((row): PacketAnswer | null => {
    if (!row || typeof row !== "object") return null;
    const record = row as Record<string, unknown>;
    const question = cleanText(record.question);
    if (!question) return null;
    return {
      section: cleanShort(record.section, "Report"),
      question,
      answer: cleanText(record.answer, "No answer recorded"),
      evidenceMarked: Boolean(record.evidenceMarked),
    };
  }).filter((row): row is PacketAnswer => row !== null);
}

function parseReports(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map((report): PacketReport | null => {
    if (!report || typeof report !== "object") return null;
    const record = report as Record<string, unknown>;
    const reportId = cleanShort(record.reportId);
    const type = cleanShort(record.type);
    const reviewRecord = record.review && typeof record.review === "object" ? record.review as Record<string, unknown> : null;
    if (!reportId || !type) return null;
    return {
      id: Number(record.id) || 0,
      reportId,
      type,
      code: cleanShort(record.code, "LOG"),
      location: cleanShort(record.location, "No location recorded"),
      date: cleanShort(record.date, "No date recorded"),
      creator: cleanShort(record.creator, "Unknown"),
      status: cleanShort(record.status, "review"),
      sourceFile: cleanShort(record.sourceFile, "Created in Bay Baby Audit"),
      evidenceTags: parseStringArray(record.evidenceTags),
      details: cleanText(record.details),
      answerRows: parseAnswers(record.answerRows),
      review: reviewRecord ? {
        note: cleanText(reviewRecord.note),
        correctiveAction: cleanText(reviewRecord.correctiveAction),
        reviewedAt: cleanShort(reviewRecord.reviewedAt),
        reviewer: cleanShort(reviewRecord.reviewer),
      } : undefined,
    };
  }).filter((report): report is PacketReport => report !== null);
}

function parsePacketRequest(input: unknown): PacketRequest | null {
  if (!input || typeof input !== "object") return null;
  const body = input as Record<string, unknown>;
  const reports = parseReports(body.reports);
  const count = Number(body.count ?? reports.length ?? heavyConnectInventory.report_count);
  const generatedBy = cleanShort(body.generatedBy, "Juan Diaz");
  const startDate = typeof body.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate) ? body.startDate : "2025-01-01";
  const endDate = typeof body.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.endDate) ? body.endDate : "2026-01-01";
  const selectedIds = Array.isArray(body.selectedIds) ? body.selectedIds.map(Number).filter(Number.isFinite).slice(0, 500) : [];
  if (!Number.isFinite(count) || count < 0 || count > 500) return null;
  if (new Date(startDate) > new Date(endDate)) return null;
  return { count, generatedBy, startDate, endDate, selectedIds, reports };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = cleanText(text, " ").split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function drawWrapped(page: PDFPage, text: string, x: number, y: number, options: { font: PDFFont; size: number; maxWidth: number; color?: ReturnType<typeof rgb>; lineGap?: number }) {
  const lines = wrapText(text, options.font, options.size, options.maxWidth);
  let currentY = y;
  for (const line of lines) {
    page.drawText(line, { x, y: currentY, size: options.size, font: options.font, color: options.color ?? rgb(0.12, 0.14, 0.13) });
    currentY -= options.size + (options.lineGap ?? 4);
  }
  return currentY;
}

function drawHeader(page: PDFPage, title: string, subtitle: string, bold: PDFFont, font: PDFFont) {
  page.drawRectangle({ x: 0, y: 728, width: pageSize[0], height: 64, color: rgb(0.04, 0.18, 0.14) });
  page.drawText("BAY BABY PRODUCE", { x: margin, y: 763, size: 9, font: bold, color: rgb(0.72, 0.9, 0.69) });
  page.drawText(title.slice(0, 58), { x: margin, y: 742, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText(subtitle.slice(0, 95), { x: margin, y: 716, size: 9, font, color: rgb(0.35, 0.38, 0.37) });
}

function drawKeyValue(page: PDFPage, label: string, value: string, x: number, y: number, font: PDFFont, bold: PDFFont) {
  page.drawText(label, { x, y, size: 8, font, color: rgb(0.42, 0.45, 0.43) });
  drawWrapped(page, value, x, y - 14, { font: bold, size: 10, maxWidth: 220, color: rgb(0.07, 0.18, 0.14), lineGap: 2 });
}

function addReportPages(pdf: PDFDocument, report: PacketReport, font: PDFFont, bold: PDFFont) {
  let page = pdf.addPage(pageSize);
  drawHeader(page, `${report.code} ${report.type}`, `${report.reportId} / ${report.status.toUpperCase()}`, bold, font);
  let y = 680;

  drawKeyValue(page, "Location", report.location, margin, y, font, bold);
  drawKeyValue(page, "Date / time", report.date, 310, y, font, bold);
  y -= 54;
  drawKeyValue(page, "Creator", report.creator, margin, y, font, bold);
  drawKeyValue(page, "Source", report.sourceFile, 310, y, font, bold);
  y -= 58;

  page.drawText("Audit mapping", { x: margin, y, size: 11, font: bold, color: rgb(0.07, 0.18, 0.14) });
  y = drawWrapped(page, report.evidenceTags.join(", ") || "No module tags recorded", margin, y - 18, { font, size: 9, maxWidth: 500, lineGap: 3 }) - 12;

  if (report.details) {
    page.drawText("Report notes", { x: margin, y, size: 11, font: bold, color: rgb(0.07, 0.18, 0.14) });
    y = drawWrapped(page, report.details, margin, y - 18, { font, size: 9, maxWidth: 500, lineGap: 3 }) - 14;
  }

  if (report.review) {
    page.drawText("Review and approval", { x: margin, y, size: 11, font: bold, color: rgb(0.07, 0.18, 0.14) });
    y -= 18;
    y = drawWrapped(page, `Reviewer: ${report.review.reviewer || "Not recorded"} / Reviewed: ${report.review.reviewedAt || "Not recorded"}`, margin, y, { font, size: 9, maxWidth: 500, lineGap: 3 }) - 4;
    if (report.review.note) y = drawWrapped(page, `Notes: ${report.review.note}`, margin, y, { font, size: 9, maxWidth: 500, lineGap: 3 }) - 4;
    if (report.review.correctiveAction) y = drawWrapped(page, `Corrective action: ${report.review.correctiveAction}`, margin, y, { font, size: 9, maxWidth: 500, lineGap: 3 }) - 12;
  }

  page.drawText("Questions and answers", { x: margin, y, size: 12, font: bold, color: rgb(0.07, 0.18, 0.14) });
  y -= 22;

  if (report.answerRows.length === 0) {
    drawWrapped(page, "No question-level answers were captured for this report.", margin, y, { font, size: 10, maxWidth: 500 });
    return;
  }

  let activeSection = "";
  for (const [index, row] of report.answerRows.entries()) {
    const questionLines = wrapText(`${index + 1}. ${row.question}`, bold, 9, 500);
    const answerText = row.evidenceMarked ? `${row.answer || "No answer recorded"} [Evidence marked]` : row.answer || "No answer recorded";
    const answerLines = wrapText(answerText, font, 9, 488);
    const rowHeight = (questionLines.length + answerLines.length) * 13 + (row.section !== activeSection ? 18 : 8);
    if (y - rowHeight < bottomMargin) {
      page = pdf.addPage(pageSize);
      drawHeader(page, `${report.code} ${report.type}`, `${report.reportId} / continued`, bold, font);
      y = 690;
      activeSection = "";
    }
    if (row.section !== activeSection) {
      activeSection = row.section;
      page.drawRectangle({ x: margin, y: y - 3, width: 508, height: 18, color: rgb(0.91, 0.95, 0.91) });
      page.drawText(activeSection.slice(0, 80), { x: margin + 8, y: y + 2, size: 9, font: bold, color: rgb(0.07, 0.24, 0.16) });
      y -= 24;
    }
    for (const line of questionLines) {
      page.drawText(line, { x: margin, y, size: 9, font: bold, color: rgb(0.08, 0.12, 0.11) });
      y -= 13;
    }
    for (const line of answerLines) {
      page.drawText(line, { x: margin + 12, y, size: 9, font, color: rgb(0.16, 0.18, 0.17) });
      y -= 13;
    }
    y -= 8;
  }
}

export async function POST(request: Request) {
  let body: PacketRequest | null = null;
  try {
    body = parsePacketRequest(await request.json());
  } catch {
    body = null;
  }
  if (!body) {
    return NextResponse.json({ error: "Invalid audit packet request" }, { status: 400 });
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(pageSize);
  const crosswalkSummary = primusCrosswalk.summary as CrosswalkSummary;
  const localSourceCount = localPrimusSources.module_sources.reduce((sum, module) => sum + module.source_count, 0);
  const reportCount = body.reports.length || body.count || 0;

  page.drawRectangle({ x: 0, y: 700, width: 612, height: 92, color: rgb(0.04, 0.18, 0.14) });
  page.drawText("BAY BABY PRODUCE", { x: margin, y: 747, size: 12, font: bold, color: rgb(0.72, 0.9, 0.69) });
  page.drawText(body.reports.length === 1 ? "Report Packet" : "PrimusGFS Audit Packet", { x: margin, y: 718, size: 25, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`${body.startDate} to ${body.endDate}`, { x: margin, y: 660, size: 16, font: bold });
  page.drawText(`Generated by ${body.generatedBy} - ${new Date().toLocaleDateString("en-US")}`, { x: margin, y: 636, size: 10, font, color: rgb(0.35, 0.38, 0.37) });

  const lines = [
    ["Reports rendered", String(reportCount)],
    ["Selected report IDs", body.selectedIds.length ? String(body.selectedIds.length) : "All scoped reports"],
    ["Question answers included", String(body.reports.reduce((sum, report) => sum + report.answerRows.length, 0))],
    ["Local PRIMUS source items", String(localSourceCount)],
    ["Historical standard basis", localPrimusSources.summary.historical_standard],
    ["Target standard", localPrimusSources.summary.future_standard],
    ["Bay Baby scoped modules", String(localPrimusSources.bay_baby_scope.active_module_keys.length)],
    ["Manual crosswalk review", `${crosswalkSummary.needs_manual_mapping ?? 0} questions`],
  ];

  let y = 560;
  for (const [label, value] of lines) {
    page.drawText(label, { x: margin, y, size: 12, font });
    drawWrapped(page, value, 390, y, { font: bold, size: 12, maxWidth: 170, color: rgb(0.07, 0.38, 0.2), lineGap: 2 });
    page.drawLine({ start: { x: margin, y: y - 12 }, end: { x: 560, y: y - 12 }, thickness: 0.5, color: rgb(0.82, 0.84, 0.82) });
    y -= 42;
  }

  page.drawText("Packet sections", { x: margin, y: 190, size: 15, font: bold });
  page.drawText("Cover sheet - Completed report forms - Question and answer appendix", { x: margin, y: 164, size: 10, font });
  page.drawText("Corrective actions - Document control register - Traceability readiness", { x: margin, y: 145, size: 10, font });
  page.drawText("Note: Local files are v3.2-era evidence; review crosswalks before official v4.0 scoring.", { x: margin, y: 102, size: 9, font, color: rgb(0.55, 0.32, 0.05) });

  if (body.reports.length === 0) {
    const empty = pdf.addPage(pageSize);
    drawHeader(empty, "No app-created reports selected", "Use Start Report, submit, approve, then generate again.", bold, font);
    drawWrapped(empty, "The packet cover was generated, but there were no live Bay Baby Audit reports in the request. Create reports in the Inspector or select existing app-created reports to render completed forms here.", margin, 670, { font, size: 11, maxWidth: 500 });
  } else {
    body.reports.forEach((report) => addReportPages(pdf, report, font, bold));
  }

  const bytes = await pdf.save();
  const filename = body.reports.length === 1 ? `Bay-Baby-${body.reports[0].reportId}-Report-Packet.pdf` : "Bay-Baby-PrimusGFS-Audit-Packet_2025-01-01_to_2026-01-01.pdf";
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
