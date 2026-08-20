import * as XLSX from "xlsx";
import type { Deal } from "./types";
import { id, parseBool, parseMoney, stateFromLocation } from "./format";

const ALIASES: Record<keyof Pick<
  Deal,
  | "name"
  | "listingUrl"
  | "industry"
  | "location"
  | "askingPrice"
  | "revenue"
  | "ebitda"
  | "sde"
  | "employees"
  | "ffe"
  | "notes"
  | "broker"
  | "source"
>, string[]> = {
  name: ["company", "company name", "name", "business", "listing name"],
  listingUrl: ["listing url", "url", "link", "listing"],
  industry: ["industry", "sector", "naics", "category"],
  location: ["location", "city", "address", "city/state", "geography"],
  askingPrice: ["asking price", "price", "ask", "asking", "purchase price"],
  revenue: ["revenue", "sales", "sales revenue", "ttm revenue", "gross sales"],
  ebitda: ["ebitda", "adj ebitda", "adjusted ebitda"],
  sde: ["sde", "cash flow", "owner benefit", "seller discretionary earnings", "sde / cash flow"],
  employees: ["employees", "ftes", "headcount", "# employees"],
  ffe: ["ffe", "ff&e", "equipment", "ff&e value"],
  notes: ["notes", "comments", "description"],
  broker: ["broker", "advisor", "listing broker"],
  source: ["source", "marketplace", "origin"],
};

function norm(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mapHeader(header: string): string | null {
  const h = norm(header);
  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  if (h.includes("real estate")) return "realEstateIncluded";
  if (h.includes("seller financ")) return "sellerFinancing";
  if (h === "state") return "state";
  return null;
}

export function parseSpreadsheet(buffer: Buffer): Omit<Deal, "id" | "batchId" | "createdAt" | "updatedAt" | "status" | "researchStatus" | "documents" | "assignedQuestions" | "fatalRisks">[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  return rows
    .map((row) => {
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
        industry: String(mapped.industry || "Unknown").trim(),
        location,
        state: String(mapped.state || stateFromLocation(location) || "").trim() || undefined,
        askingPrice: parseMoney(mapped.askingPrice),
        revenue: parseMoney(mapped.revenue),
        ebitda: parseMoney(mapped.ebitda),
        sde: parseMoney(mapped.sde),
        employees: parseMoney(mapped.employees),
        realEstateIncluded: parseBool(row["Real Estate Included"] ?? row["Real Estate"] ?? row["RE Included"]),
        ffe: parseMoney(mapped.ffe),
        sellerFinancing: parseBool(row["Seller Financing"] ?? row["Seller Note"]),
        notes: mapped.notes ? String(mapped.notes) : undefined,
        broker: mapped.broker ? String(mapped.broker) : undefined,
        source: mapped.source ? String(mapped.source) : undefined,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
}

export function toDeal(
  row: ReturnType<typeof parseSpreadsheet>[number],
  batchId: string
): Deal {
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
