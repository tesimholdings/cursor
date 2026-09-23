import { companyScan } from "./company-scan";
import { looksLikeOcrDump, stripRepeatedName } from "./copy";
import { money } from "./format";
import type { Deal } from "./types";

export interface BoardCardLines {
  what: string;
  cash: string;
  ugly: string;
  call: string;
  closeSpeed: "Fast" | "Mid" | "Slow";
  openCimUrl: string | null;
}

function oneLine(text: string, max = 160) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || looksLikeOcrDump(clean)) return "";
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 80 ? cut.slice(0, space) : cut).trim()}…`;
}

function stripBoilerplate(text: string) {
  let next = text.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 4; i += 1) {
    const stripped = next
      .replace(/^no cim on card\.?\s*/i, "")
      .replace(/^teaser screen, not an ic\.?\s*/i, "")
      .replace(/^ais[_ ]tight\b[:\s-]*/i, "")
      .trim();
    if (stripped === next) break;
    next = stripped;
  }
  return next;
}

function whatItDoes(deal: Deal, summary: string) {
  const stripped = stripRepeatedName(stripBoilerplate(summary), deal.name);
  const sentence = oneLine(
    stripped.split(/(?<=[.!?])\s+/)[0] || stripped
  );
  if (sentence && !/^is listed as\b/i.test(sentence)) return sentence;
  const industry = oneLine(deal.industry || "");
  if (industry) return industry;
  if (sentence) return sentence;
  return "What it does is not printed.";
}

function storedAsk(deal: Deal) {
  if (deal.askingPrice != null && Number.isFinite(deal.askingPrice)) {
    return `Ask ${money(deal.askingPrice)}`;
  }
  const fact = deal.dealPicture?.facts?.find(
    (item) => item.label.toLowerCase() === "ask"
  );
  const value = (fact?.value || "").replace(/\s+/g, " ").trim();
  if (!value || !/\$\s*\d/.test(value) || looksLikeOcrDump(value)) {
    return "Ask not printed";
  }
  const amount = value
    .replace(/^\s*ask\s*/i, "")
    .replace(/\s*\(?seller claim(?:\s*[—–-]\s*recast)?\)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return amount ? `Ask ${amount}` : "Ask not printed";
}

function printedAmount(value: number | null | undefined, label: string) {
  if (value == null || Number.isNaN(value)) return `${label} not printed`;
  return `${label} ${money(value)}`;
}

/** Ask, then Seller Claim revenue and SDE. Recast SDE is Seller Claim. Missing figures stay blank. */
export function cashLine(deal: Deal) {
  const ask = storedAsk(deal);
  const rev = printedAmount(deal.revenue, "rev");
  const earnValue = deal.sde ?? deal.ebitda;
  const earnLabel = deal.sde != null ? "SDE" : deal.ebitda != null ? "EBITDA" : "SDE";
  const earn = printedAmount(earnValue, earnLabel);
  const sellerClaim = deal.earningsQuality !== "Tax-tied";
  return `${ask} · ${sellerClaim ? "Seller Claim " : ""}${rev} / ${earn}`;
}

function uglyLine(deal: Deal, ugly: string) {
  const clean = oneLine(ugly.replace(/^ugly:\s*/i, ""));
  if (clean) return `Ugly: ${clean}`;
  const risk = (deal.fatalRisks || []).map((item) => oneLine(item)).find(Boolean);
  if (risk) return `Ugly: ${risk.replace(/^ugly:\s*/i, "")}`;
  return "Ugly not printed.";
}

export function boardCardLines(deal: Deal): BoardCardLines {
  const scan = companyScan(deal);
  const score = Number.isFinite(scan.score) ? String(scan.score) : "—";
  return {
    what: whatItDoes(deal, scan.summary),
    cash: cashLine(deal),
    ugly: uglyLine(deal, scan.ugly),
    call: `${scan.call} · ${scan.scoreLabel} ${score}`,
    closeSpeed: scan.closeSpeed,
    openCimUrl: scan.openCimUrl,
  };
}
