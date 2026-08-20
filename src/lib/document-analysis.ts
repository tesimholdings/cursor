import type { CustomerRow, Deal, DocumentRecord } from "./types";
import { parseMoney } from "./format";

export interface CustomerConcentrationAnalysis {
  customers: CustomerRow[];
  top1: number | null;
  top3: number | null;
  top5: number | null;
  reportTotal: number | null;
  note: string;
  hasCustomerContracts: boolean;
}

export function analyzeCustomerConcentration(
  deal: Deal
): CustomerConcentrationAnalysis {
  const candidates = deal.documents
    .filter((document) => document.category === "customers")
    .flatMap((document) =>
      (document.extraction?.tables || []).map((table) => ({ document, table }))
    );

  for (const { document, table } of candidates) {
    const customerHeader = table.headers.find((header) =>
      /customer|client/i.test(header)
    );
    const revenueHeader = table.headers.find((header) =>
      /revenue|sales/i.test(header)
    );
    const shareHeader = table.headers.find((header) =>
      /share|percent|%|concentration/i.test(header)
    );
    if (!customerHeader || (!revenueHeader && !shareHeader)) continue;

    const parsed = table.rows
      .map((row) => {
        const name = String(row.values[customerHeader] ?? "").trim();
        if (!name || /^total|grand total|all customers$/i.test(name)) return null;
        const revenue = revenueHeader
          ? parseMoney(row.values[revenueHeader])
          : null;
        const shareRaw = shareHeader ? row.values[shareHeader] : null;
        const share = parseShare(shareRaw);
        if ((revenue == null || revenue < 0) && share == null) return null;
        return {
          name,
          revenue: revenue || 0,
          explicitShare: share,
          source: {
            documentId: document.id,
            sheet: table.sheet,
            cell: [
              row.cells[customerHeader],
              revenueHeader ? row.cells[revenueHeader] : undefined,
              shareHeader ? row.cells[shareHeader] : undefined,
            ]
              .filter(Boolean)
              .join(","),
          },
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    if (parsed.length < 2) continue;

    const reportTotal = parsed.reduce((sum, row) => sum + row.revenue, 0);
    if (
      reportTotal <= 0 &&
      !parsed.every((row) => row.explicitShare != null)
    ) {
      continue;
    }
    const customers = parsed
      .map<CustomerRow>((row) => ({
        name: row.name,
        revenue: row.revenue,
        share:
          row.explicitShare != null
            ? row.explicitShare
            : row.revenue / reportTotal,
        tenure: "NOT PROVIDED",
        source: row.source,
      }))
      .sort((a, b) => b.share - a.share);
    const sumTop = (count: number) =>
      customers.slice(0, count).reduce((sum, customer) => sum + customer.share, 0);
    const discrepancy =
      deal.revenue && reportTotal
        ? Math.abs(deal.revenue - reportTotal) /
          Math.max(deal.revenue, reportTotal)
        : null;
    return {
      customers,
      top1: sumTop(1),
      top3: sumTop(3),
      top5: sumTop(5),
      reportTotal: reportTotal || null,
      note: `AI CALCULATION from ${document.name}, sheet ${table.sheet}. ${
        discrepancy != null && discrepancy > 0.05
          ? `CONFLICT: customer report totals ${formatNumber(
              reportTotal
            )} versus listed revenue ${formatNumber(deal.revenue || 0)}.`
          : "Customer report total is usable as the concentration denominator."
      }`,
      hasCustomerContracts: hasCustomerContracts(deal.documents),
    };
  }

  return {
    customers: [],
    top1: null,
    top3: null,
    top5: null,
    reportTotal: null,
    note:
      "NOT PROVIDED — no readable customer revenue table with customer and revenue/share columns was found.",
    hasCustomerContracts: hasCustomerContracts(deal.documents),
  };
}

export function hasReadableDocument(
  documents: DocumentRecord[],
  predicate: (document: DocumentRecord) => boolean
) {
  return documents.some(
    (document) =>
      predicate(document) && document.extraction?.status === "complete"
  );
}

function hasCustomerContracts(documents: DocumentRecord[]) {
  return documents.some((document) => {
    if (
      document.extraction?.status !== "complete" ||
      !["legal", "customers"].includes(document.category)
    ) {
      return false;
    }
    const text = document.extraction.chunks
      .map((chunk) => chunk.text)
      .join(" ");
    return /customer contract|supply agreement|master service agreement|purchase agreement|change.of.control/i.test(
      `${document.name} ${text}`
    );
  });
}

function parseShare(value: unknown): number | null {
  if (typeof value === "number") {
    if (value >= 0 && value <= 1) return value;
    if (value > 1 && value <= 100) return value / 100;
  }
  if (typeof value === "string") {
    const match = value.match(/([\d.]+)\s*%/);
    if (match) return Number(match[1]) / 100;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      if (numeric >= 0 && numeric <= 1) return numeric;
      if (numeric > 1 && numeric <= 100) return numeric / 100;
    }
  }
  return null;
}

function formatNumber(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
