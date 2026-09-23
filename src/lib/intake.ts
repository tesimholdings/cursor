import { parseMoney } from "./format";

export interface ParsedListing {
  name: string;
  industry: string;
  location: string;
  listingUrl?: string;
  websiteUrl?: string;
  askingPrice: number | null;
  revenue: number | null;
  ebitda: number | null;
  sde: number | null;
  notes: string;
}

export function parsePastedListing(text: string): ParsedListing {
  const cleaned = text.trim();
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const name =
    field(cleaned, ["company name", "company", "business name"]) ||
    lines.find((line) => !looksLikeField(line)) ||
    "";
  return {
    name: name.replace(/^[-#*\s]+/, "").trim(),
    industry: field(cleaned, ["industry", "business type", "sector"]) || "Unknown",
    location: field(cleaned, ["location", "city/state", "city"]) || "",
    listingUrl: urlField(cleaned, ["listing url", "listing link"]),
    websiteUrl: urlField(cleaned, ["company website", "website"]),
    askingPrice: moneyField(cleaned, ["asking price", "ask", "price"]),
    revenue: moneyField(cleaned, ["revenue", "sales"]),
    ebitda: moneyField(cleaned, ["ebitda"]),
    sde: moneyField(cleaned, [
      "sde",
      "seller discretionary earnings",
      "cash flow",
    ]),
    notes: cleaned,
  };
}

function field(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(
      new RegExp(`(?:^|\\n)\\s*${escapeRegex(label)}\\s*[:\\-]\\s*([^\\n]+)`, "i")
    );
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function moneyField(text: string, labels: string[]) {
  const value = field(text, labels);
  return value ? parseMoney(value) : null;
}

function urlField(text: string, labels: string[]) {
  const value = field(text, labels);
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function looksLikeField(line: string) {
  return /^(company|business|industry|sector|location|city|asking|ask|price|revenue|sales|ebitda|sde|cash flow|website|listing)\s*[:\-]/i.test(
    line
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
