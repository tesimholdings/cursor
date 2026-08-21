import { closeSpeedFor } from "./close-speed";
import {
  firstSentences,
  looksLikeOcrDump,
  readableDocumentText,
  stripLeadingName,
  unanswered,
} from "./copy";
import { money, multiple } from "./format";
import { headlineScore } from "./board-scoring";
import type { Deal, DealPicture, DealPictureFact, DocumentRecord } from "./types";

export const DEAL_PICTURE_VERSION = 7;

const BUSINESS_HINT =
  /\b(provides?|manufactur|sells?|specializ|serves?|produces?|offers?|operat|designs?|installs?|customers?|revenue|employees?|injection|thermal spray|landscap|contractor|general contractor|hvaf|powder feeder)\b/i;

export function hasReadableCim(deal: Deal) {
  return deal.documents.some(
    (document) =>
      document.category === "cim" &&
      documentHasText(document) &&
      !isPlaceholderCim(documentText(document))
  );
}

export function collapseSpacedCaps(text: string) {
  return text.replace(/(?:[A-Z]\s+){3,}[A-Z]/g, (match) =>
    match.replace(/\s+/g, "")
  );
}

function documentText(document: DocumentRecord) {
  return collapseSpacedCaps(
    (
      document.textExcerpt ||
      readableDocumentText(document.extraction?.chunks || [])
    ).replace(/\s+/g, " ")
  ).trim();
}

export function isPlaceholderCim(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return (
    /demo cim placeholder/i.test(compact) ||
    (compact.length < 280 &&
      /not provided\.?$/i.test(compact) &&
      /concentration, contracts, certifications/i.test(compact))
  );
}

export function documentHasText(document: DocumentRecord) {
  return Boolean(
    document.textExcerpt?.trim() ||
      document.extraction?.chunks.some((chunk) => chunk.text.trim())
  );
}

export function packetText(
  deal: Deal,
  categories: DocumentRecord["category"][] = ["cim", "financials", "listing"]
) {
  return deal.documents
    .filter((document) => categories.includes(document.category))
    .map((document) => documentText(document))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const SHOP_LINES: Array<{ pattern: RegExp; sell: string; pay?: string }> = [
  {
    pattern: /hvaf|thermal spray|powder feeder/i,
    sell: "They sell HVAF spray systems and powder feeders.",
    pay: "Industrial plants pay for the equipment and for job-shop coating.",
  },
  {
    pattern: /injection mold|plastic injection/i,
    sell: "They injection-mold plastic parts.",
    pay: "Industrial and OEM customers pay for the molded parts.",
  },
  {
    pattern: /landscap|hardscape|irrigation/i,
    sell: "They do landscaping, hardscape, and irrigation.",
    pay: "Builders and homeowners pay.",
  },
  {
    pattern: /general contractor|design[\s-]build construction/i,
    sell: "They run a design-build general contracting shop.",
    pay: "County, school, and federal owners pay.",
  },
  {
    pattern: /protective finish|industrial coating/i,
    sell: "They apply protective finishes for industrial customers.",
  },
];

function shopLocation(deal: Deal) {
  if (!deal.location) return "";
  return `The shop runs in ${deal.location}.`;
}

function uglyLine(text: string) {
  if (/customer[\s-]owned (?:molds?|tooling)|customers own their patented molds/i.test(text)) {
    return "Ugly: customer-owned molds / tooling.";
  }
  if (
    /government[\s-]?(?:contractor|gc|project)|county government|federal government|set[\s-]?aside/i.test(
      text
    )
  ) {
    return "Ugly: government / public-sector work — Slow close.";
  }
  if (/\binventor\b/i.test(text) && /\bfound(?:er|ed)\b/i.test(text)) {
    return "Ugly: founder-inventor key-person, not a plant hall.";
  }
  if (/franchise/i.test(text)) return "Ugly: franchise language is in the file.";
  return "";
}

export function listingProse(deal: Deal, maxSentences = 2) {
  const brief = deal.documents
    .filter((document) => document.category === "listing")
    .map((document) => documentText(document))
    .map((text) => {
      const briefMatch = text.match(/\bBRIEF\s+(.{40,320})/i);
      return (briefMatch?.[1] || "").replace(/\s+/g, " ").trim();
    })
    .find(
      (text) =>
        text &&
        !looksLikeOcrDump(text) &&
        BUSINESS_HINT.test(text) &&
        !/tavily public screen|identity: (confirmed|mismatch)/i.test(text)
    );
  if (!brief) return "";
  return firstSentences(stripLeadingName(brief, deal.name), maxSentences);
}

/** Composed shop line only — never a CIM/OCR paste. */
export function cimProse(deal: Deal, maxSentences = 3) {
  return composeShopSummary(deal, maxSentences).summary;
}

export function composeShopSummary(deal: Deal, maxSentences = 3) {
  const cim = hasReadableCim(deal);
  const text = packetText(deal, cim ? ["cim", "financials"] : ["listing"]);
  if (cim && looksLikeOcrDump(text) && !SHOP_LINES.some((line) => line.pattern.test(text))) {
    return { summary: "", parsed: false, ugly: "" };
  }
  const match = SHOP_LINES.find((line) => line.pattern.test(text));
  if (cim && !match) {
    const listing = listingProse(deal, 2);
    if (listing && !looksLikeOcrDump(listing)) {
      return {
        summary: firstSentences(`No CIM parse. ${listing}`, maxSentences),
        parsed: false,
        ugly: uglyLine(text),
      };
    }
    return { summary: "", parsed: false, ugly: uglyLine(text) };
  }
  const location = shopLocation(deal);
  const ugly = uglyLine(text);
  const parts = match
    ? [match.sell, match.pay, location].filter(Boolean)
    : listingProse(deal, 2)
      ? [listingProse(deal, 2)]
      : deal.notes &&
          !looksLikeOcrDump(deal.notes) &&
          !/appears to sell/i.test(deal.notes)
        ? [firstSentences(stripLeadingName(deal.notes, deal.name), 1)]
        : [];
  const summary = firstSentences(parts.join(" "), maxSentences);
  if (looksLikeOcrDump(summary) || /confidential|offering memorandum|lake bellevue/i.test(summary)) {
    return { summary: "", parsed: false, ugly };
  }
  return { summary, parsed: Boolean(match || summary), ugly };
}

export function printedConcentration(text: string) {
  const match = text.match(
    /\b(?:top|largest|single|#1|number one)\s+customer[^.%]{0,50}?(\d{1,2}(?:\.\d+)?)\s*%/i
  );
  if (!match) return null;
  const around = text.slice(
    Math.max(0, (match.index || 0) - 8),
    (match.index || 0) + match[0].length + 8
  );
  if (/\d\s*[–-]\s*\d/.test(around)) return null;
  return `${match[1]}%`;
}

function fact(
  label: string,
  value: string,
  kind: DealPictureFact["kind"],
  source?: string
): DealPictureFact {
  return { label, value, kind, source };
}

function toAmount(raw: string, suffix?: string) {
  let value = Number(raw.replace(/,/g, ""));
  const tag = (suffix || "").toLowerCase();
  if (tag === "k") value *= 1_000;
  if (tag === "m" || tag === "million") value *= 1_000_000;
  return value;
}

function labeledAmounts(
  text: string,
  labels: string[],
  kind: "rev" | "sde" | "ask" | "ebitda"
) {
  const found: Array<{ value: number; score: number }> = [];
  const label = labels.join("|");
  const after = new RegExp(
    `(?:${label})[^\\d$%]{0,28}\\$\\s*([0-9][0-9,]*(?:\\.\\d+)?)\\s*(m|million|k)?`,
    "gi"
  );
  const before = new RegExp(
    `\\$\\s*([0-9][0-9,]*(?:\\.\\d+)?)\\s*(m|million|k)?[^$.]{0,32}(?:${label})`,
    "gi"
  );
  const push = (value: number, slice: string, preferAfter: boolean) => {
    if (value < 10_000) return;
    let score = preferAfter ? 2 : 0;
    if (kind === "rev" && /trailing 3|t3 avg|ttm|annual revenue/i.test(slice)) score += 6;
    if (kind === "sde" && /trailing 3|t3 avg|discretionary|adjusted sde/i.test(slice)) score += 6;
    if (kind === "ask" && /asking price|sale price of|asset sale for/i.test(slice)) score += 6;
    if (kind !== "rev" && /\brevenue\b/i.test(slice)) score -= 5;
    if (kind !== "sde" && /\bsde\b|discretionary/i.test(slice)) score -= 5;
    if (kind === "ask" && /finance|of the sale price/i.test(slice)) score -= 8;
    if (kind === "sde" && /\brevenue\b/i.test(slice)) score -= 6;
    found.push({ value, score });
  };
  for (const match of text.matchAll(after)) {
    push(toAmount(match[1], match[2]), match[0], true);
  }
  for (const match of text.matchAll(before)) {
    push(toAmount(match[1], match[2]), match[0], false);
  }
  return found.sort((a, b) => b.score - a.score);
}

function locateMoney(
  text: string,
  labels: string[],
  kind: "rev" | "sde" | "ask" | "ebitda",
  exclude: number[] = []
) {
  return (
    labeledAmounts(text, labels, kind).find(
      (item) => !exclude.includes(item.value) && item.score > 0
    )?.value ?? null
  );
}

function answered(item: DealPictureFact | null): item is DealPictureFact {
  return Boolean(item && item.kind !== "UNANSWERED");
}

export function visibleDealPictureFacts(facts: DealPictureFact[]) {
  return facts.filter((item) => item.kind !== "UNANSWERED");
}

export function buildDealPicture(deal: Deal): DealPicture {
  const cim = hasReadableCim(deal);
  const text = packetText(deal, ["cim", "financials"]);
  const cimText = packetText(deal, ["cim"]);
  const close = closeSpeedFor(deal);
  const headline = headlineScore(deal);
  const composed = composeShopSummary(deal, 3);
  const recast = /\b(add[\s-]?backs?|recast|adjusted (?:ebitda|sde)|normalized (?:ebitda|sde)|trailing 3[\s-]?year avg sde)\b/i.test(
    text
  );

  const packetSde = locateMoney(
    cimText,
    [
      "trailing 3[\\s-]*year avg(?:erage)? sde",
      "t3 avg sde",
      "seller.?s discretionary",
      "seller discretionary",
      "adjusted sde",
      "\\bsde\\b",
    ],
    "sde"
  );
  const packetRev = locateMoney(
    cimText,
    [
      "trailing 3[\\s-]*year avg(?:erage)? revenue",
      "t3 avg revenue",
      "ttm revenue",
      "annual revenue",
      "\\brevenue\\b",
    ],
    "rev",
    packetSde != null ? [packetSde] : []
  );
  const packetAsk = locateMoney(
    cimText,
    ["asking price", "sale price of", "asset sale for a sale price"],
    "ask"
  );
  const packetEbitda = locateMoney(
    cimText,
    ["\\bebitda\\b"],
    "ebitda",
    [
      ...(packetSde != null ? [packetSde] : []),
      ...(packetRev != null ? [packetRev] : []),
    ]
  );
  const ask = packetAsk ?? deal.askingPrice ?? null;
  const earnings = packetSde ?? packetEbitda ?? deal.sde ?? deal.ebitda ?? null;
  const askMultiple = multiple(ask, earnings);
  const concentration = printedConcentration(text);
  const peopleMatch =
    text.match(/\b(\d{1,3})\s*(?:full[\s-]?time|ft)\s*employees?\b/i) ||
    text.match(/\b(\d{1,3})FULL-TIME\s*EMPLOYEES\b/i) ||
    text.match(/\b(\d{1,3})\s+employees?\b/i);
  const people = peopleMatch?.[1];
  const reSplit = /real estate only[^$]{0,12}\$?\s*([0-9,.]+)|business only[^$]{0,12}\$?\s*([0-9,.]+)/i.exec(
    text
  );

  const facts = [
    ask != null
      ? fact(
          "Ask",
          packetAsk != null
            ? money(packetAsk)
            : `${money(deal.askingPrice)} (Seller Claim)`,
          packetAsk != null ? "CIM_FACT" : "SELLER_CLAIM"
        )
      : fact("Ask", unanswered("no printed figure"), "UNANSWERED"),
    packetRev != null
      ? fact("Revenue", money(packetRev), "CIM_FACT")
      : deal.revenue != null
        ? fact("Revenue", `${money(deal.revenue)} (Seller Claim)`, "SELLER_CLAIM")
        : fact("Revenue", unanswered("no printed figure"), "UNANSWERED"),
    earnings != null
      ? fact(
          "Earnings",
          `${money(packetSde ?? packetEbitda ?? deal.sde ?? deal.ebitda)}${
            recast || packetSde != null
              ? " (Seller Claim — recast)"
              : packetSde == null && deal.sde != null
                ? " (Seller Claim)"
                : ""
          }`,
          recast || packetSde != null || (packetEbitda == null && deal.sde != null)
            ? "SELLER_CLAIM"
            : "CIM_FACT"
        )
      : fact("Earnings", unanswered("no printed figure"), "UNANSWERED"),
    askMultiple != null
      ? fact("Multiple", `${askMultiple.toFixed(1)}x listed earnings`, "CIM_FACT")
      : fact("Multiple", unanswered("need ask and earnings"), "UNANSWERED"),
    people
      ? fact("People", `${people} FT`, "CIM_FACT")
      : deal.employees != null
        ? fact("People", `${deal.employees} (Seller Claim)`, "SELLER_CLAIM")
        : fact("People", unanswered("headcount"), "UNANSWERED"),
    concentration
      ? fact("Concentration", concentration, "CIM_FACT")
      : fact("Concentration", unanswered("no printed customer %"), "UNANSWERED"),
    reSplit
      ? fact("RE", "CIM split printed (RE / business)", "CIM_FACT")
      : deal.realEstateIncluded === true
        ? fact("RE", "Listing says RE included — Seller Claim", "SELLER_CLAIM")
        : deal.realEstateIncluded === false
          ? fact("RE", "Listing says no real estate in the ask", "SELLER_CLAIM")
          : fact("RE", unanswered("RE vs business split"), "UNANSWERED"),
    fact("Close speed", `${close} close`, "CIM_FACT"),
  ].filter(answered);

  const unansweredItems = [
    cim && !composed.parsed ? "CIM text not parsed" : "",
    !cim ? "CIM / confidential information memorandum" : "",
    !concentration ? "Top-customer % — not printed" : "",
  ].filter(Boolean);

  const summary = cim
    ? composed.summary
    : composed.summary
      ? `No CIM on card. ${firstSentences(composed.summary, 2)}`
      : "No CIM on card.";

  return {
    version: DEAL_PICTURE_VERSION,
    status: cim ? "from_cim" : "no_cim",
    summary,
    ugly: composed.ugly || undefined,
    facts,
    risks: composed.ugly ? [composed.ugly] : [],
    unanswered: unansweredItems,
    rebuiltAt: new Date().toISOString(),
    scoreLabel: headline.label,
    score: headline.score,
    closeSpeed: close,
  };
}

export function shouldRefreshDealPicture(deal: Deal) {
  return (
    deal.dealPicture?.version !== DEAL_PICTURE_VERSION ||
    (hasReadableCim(deal) && deal.dealPicture.status !== "from_cim") ||
    (!hasReadableCim(deal) && deal.dealPicture?.status === "from_cim")
  );
}

export function tightenStoredNotes(deal: Deal, summary: string) {
  if (looksLikeOcrDump(deal.notes)) {
    return summary || undefined;
  }
  if (!deal.notes) return summary || deal.notes;
  return deal.notes;
}
