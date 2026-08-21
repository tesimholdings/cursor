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
  name: [
    "company",
    "company name",
    "name",
    "business",
    "business name",
    "listing name",
    "listing title",
    "opportunity",
    "opportunity name",
  ],
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
  if (fileName.toLowerCase().endsWith(".csv")) {
    return dealsFromGrid(csvGrid(buffer));
  }
  return workbookDeals(buffer);
}

function csvGrid(buffer: Buffer): unknown[][] {
  return parseCsv(buffer.toString("utf8"), {
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as unknown[][];
}

interface SheetCandidate {
  deals: ImportableDeal[];
  mappedColumns: number;
  listHints: number;
  likelyDealList: boolean;
  sheetIndex: number;
}

const DEAL_SHEET_HINT =
  /\b(deals?|listings?|opportunit(?:y|ies)|scorecards?|targets?|pipeline|acquisitions?)\b/i;
const LIST_COLUMN_HINT =
  /\b(score|rank|decision|status|stage|recommendation|broker call)\b/i;

async function workbookDeals(buffer: Buffer): Promise<ImportableDeal[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const candidates = workbook.worksheets
    .map((worksheet, sheetIndex) => {
      const grid: unknown[][] = [];
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const values: unknown[] = [];
        row.eachCell({ includeEmpty: true }, (cell, column) => {
          values[column - 1] = primitiveCell(cell.value);
        });
        grid.push(values);
      });
      const parsed = bestGridCandidate(grid);
      if (!parsed) return null;
      return {
        ...parsed,
        likelyDealList: DEAL_SHEET_HINT.test(worksheet.name),
        sheetIndex,
      } satisfies SheetCandidate;
    })
    .filter((candidate): candidate is SheetCandidate => Boolean(candidate));

  // A broker workbook commonly has a cover/analysis sheet followed by one
  // actual listings table. Importing every sheet risks turning a named
  // company's supporting financial tab into another company. Choose the
  // strongest company-list table. A clearly named listings/scorecard sheet
  // wins first. Otherwise recognized listing columns and table-oriented score
  // headers keep a large generic "Name" table (for example an employee list)
  // from outranking an actual broker list.
  candidates.sort(
    (a, b) =>
      Number(b.likelyDealList) - Number(a.likelyDealList) ||
      candidateStrength(b) - candidateStrength(a) ||
      a.sheetIndex - b.sheetIndex
  );
  return candidates[0]?.deals ?? [];
}

function candidateStrength(candidate: {
  deals: ImportableDeal[];
  mappedColumns: number;
  listHints: number;
}) {
  return (
    candidate.mappedColumns * 100 +
    candidate.listHints * 50 +
    Math.min(candidate.deals.length, 99)
  );
}

interface HeaderMatch {
  rowIndex: number;
  headers: string[];
  mappedColumns: number;
  listHints: number;
}

function findHeaders(grid: unknown[][]): HeaderMatch[] {
  const matches: HeaderMatch[] = [];
  // Limit pathological formatted workbooks while allowing substantial cover
  // material before the table. Empty rows are omitted from workbook grids.
  const scanLimit = Math.min(grid.length, 200);
  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const headers = grid[rowIndex].map((value) =>
      String(primitiveCell(value as ExcelJS.CellValue) ?? "").trim()
    );
    const mapped = headers.map(mapHeader);
    if (!mapped.includes("name")) continue;
    // A single title cell such as "Company" is not enough evidence of a table.
    // Real scorecards may have only one recognized field, but still have score
    // or rank columns beside the name.
    if (headers.filter(Boolean).length < 2) continue;
    matches.push({
      rowIndex,
      headers,
      mappedColumns: new Set(mapped.filter(Boolean)).size,
      listHints: headers.filter((header) => LIST_COLUMN_HINT.test(header)).length,
    });
  }
  return matches;
}

function dealsForHeader(
  grid: unknown[][],
  header: HeaderMatch
): ImportableDeal[] {
  const rows: ImportableDeal[] = [];
  for (const values of grid.slice(header.rowIndex + 1)) {
    const record: Record<string, unknown> = {};
    header.headers.forEach((columnName, index) => {
      if (columnName) record[columnName] = values[index] ?? "";
    });
    const deal = toImportableDeal(record);
    // Repeated headers inside a long sheet are separators, not companies.
    if (deal && mapHeader(deal.name) !== "name") rows.push(deal);
  }
  return rows;
}

function bestGridCandidate(
  grid: unknown[][]
): Omit<SheetCandidate, "sheetIndex" | "likelyDealList"> | null {
  const candidates = findHeaders(grid)
    .map((header) => ({
      deals: dealsForHeader(grid, header),
      mappedColumns: header.mappedColumns,
      listHints: header.listHints,
      rowIndex: header.rowIndex,
    }))
    .filter((candidate) => candidate.deals.length);
  candidates.sort(
    (a, b) =>
      candidateStrength(b) - candidateStrength(a) ||
      // Later wins an otherwise exact tie because title/cover material appears
      // before the real table.
      b.rowIndex - a.rowIndex
  );
  const best = candidates[0];
  if (!best) return null;
  return {
    deals: best.deals,
    mappedColumns: best.mappedColumns,
    listHints: best.listHints,
  };
}

function dealsFromGrid(grid: unknown[][]): ImportableDeal[] {
  return bestGridCandidate(grid)?.deals ?? [];
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
