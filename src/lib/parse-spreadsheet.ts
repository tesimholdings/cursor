import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";
import type { Deal } from "./types";
import {
  id,
  parseBool,
  parseMoney,
  stateFromLocation,
} from "./format";

type ImportableDeal = Omit<
  Deal,
  | "id"
  | "batchId"
  | "createdAt"
  | "updatedAt"
  | "status"
  | "researchStatus"
  | "documents"
  | "assignedQuestions"
  | "fatalRisks"
>;

const ALIASES: Record<string, string[]> = {
  name: ["company", "company name", "name", "business", "listing name"],
  listingUrl: ["listing url", "url", "link", "listing"],
  websiteUrl: ["website", "company website", "business website", "website url"],
  industry: ["industry", "sector", "naics", "category"],
  location: ["location", "city", "address", "city/state", "geography"],
  askingPrice: ["asking price", "price", "ask", "asking", "purchase price"],
  revenue: ["revenue", "sales", "sales revenue", "ttm revenue", "gross sales"],
  ebitda: ["ebitda", "adj ebitda", "adjusted ebitda"],
  sde: [
    "sde",
    "cash flow",
    "owner benefit",
    "seller discretionary earnings",
    "sde / cash flow",
  ],
  employees: ["employees", "ftes", "headcount", "# employees"],
  ffe: ["ffe", "ff&e", "equipment", "ff&e value"],
  notes: ["notes", "comments", "description"],
  broker: ["broker", "advisor", "listing broker"],
  source: ["source", "marketplace", "origin"],
};

function norm(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mapHeader(header: string): string | null {
  const normalized = norm(header);
  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(normalized)) return field;
  }
  if (normalized.includes("real estate")) return "realEstateIncluded";
  if (normalized.includes("seller financ")) return "sellerFinancing";
  if (normalized === "state") return "state";
  return null;
}

export async function parseSpreadsheet(
  buffer: Buffer,
  fileName = "upload.xlsx"
): Promise<ImportableDeal[]> {
  const rows = fileName.toLowerCase().endsWith(".csv")
    ? csvRows(buffer)
    : await workbookRows(buffer);
  return rows
    .map(toImportableDeal)
    .filter((row): row is ImportableDeal => Boolean(row));
}

function csvRows(buffer: Buffer): Record<string, unknown>[] {
  return parseCsv(buffer.toString("utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as Record<string, unknown>[];
}

async function workbookRows(
  buffer: Buffer
): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  const headers: string[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
    headers[column] = cellText(cell.value);
  });
  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, column) => {
      if (!header) return;
      const value = primitiveCell(row.getCell(column).value);
      if (value != null && String(value).trim() !== "") hasValue = true;
      record[header] = value ?? "";
    });
    if (hasValue) rows.push(record);
  });
  return rows;
}

function toImportableDeal(
  row: Record<string, unknown>
): ImportableDeal | null {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const field = mapHeader(key);
    if (field) mapped[field] = value;
  }
  const name = String(mapped.name || "").trim();
  if (!name) return null;
  const location = String(mapped.location || mapped.state || "").trim();
  return {
    name,
    listingUrl: mapped.listingUrl ? String(mapped.listingUrl) : undefined,
    websiteUrl: mapped.websiteUrl ? String(mapped.websiteUrl) : undefined,
    industry: String(mapped.industry || "Unknown").trim(),
    location,
    state:
      String(mapped.state || stateFromLocation(location) || "").trim() ||
      undefined,
    askingPrice: parseMoney(mapped.askingPrice),
    revenue: parseMoney(mapped.revenue),
    ebitda: parseMoney(mapped.ebitda),
    sde: parseMoney(mapped.sde),
    employees: parseMoney(mapped.employees),
    realEstateIncluded: parseBool(
      mapped.realEstateIncluded ??
        row["Real Estate Included"] ??
        row["Real Estate"] ??
        row["RE Included"]
    ),
    ffe: parseMoney(mapped.ffe),
    sellerFinancing: parseBool(
      mapped.sellerFinancing ??
        row["Seller Financing"] ??
        row["Seller Note"]
    ),
    notes: mapped.notes ? String(mapped.notes) : undefined,
    broker: mapped.broker ? String(mapped.broker) : undefined,
    source: mapped.source ? String(mapped.source) : undefined,
  };
}

function primitiveCell(
  value: ExcelJS.CellValue
): string | number | boolean | null {
  if (value == null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
  if (value instanceof Date) return value.toISOString();
  if ("result" in value) {
    return primitiveCell(value.result as ExcelJS.CellValue);
  }
  if ("text" in value) return String(value.text);
  if ("richText" in value)
    return value.richText.map((part) => part.text).join("");
  if ("hyperlink" in value) return String(value.hyperlink);
  return String(value);
}

function cellText(value: ExcelJS.CellValue) {
  return String(primitiveCell(value) ?? "").trim();
}

export function toDeal(row: ImportableDeal, batchId: string): Deal {
  const now = new Date().toISOString();
  return {
    id: id("deal"),
    batchId,
    ...row,
    status: "imported",
    researchStatus: "pending",
    createdAt: now,
    updatedAt: now,
    documents: [],
    assignedQuestions: [],
    fatalRisks: [],
  };
}
