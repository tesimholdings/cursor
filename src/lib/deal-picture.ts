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

export const DEAL_PICTURE_VERSION = 1;

const BUSINESS_HINT =
  /\b(provides?|manufactur|sells?|specializ|serves?|produces?|offers?|operat|designs?|installs?|customers?|revenue|employees?|injection|thermal spray|landscap|contractor|general contractor)\b/i;

export function hasReadableCim(deal: Deal) {
  return deal.documents.some(
    (document) => document.category === "cim" && documentHasText(document)
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
    .map(
      (document) =>
        document.textExcerpt ||
        readableDocumentText(document.extraction?.chunks || [])
    )
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cimProse(deal: Deal, maxSentences = 4) {
  const raw = packetText(deal, ["cim"]);
  if (!raw) return "";
  const parts = raw
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(
      (part) =>
        part.length >= 40 &&
        part.length <= 320 &&
        !/page \d+|table of contents|confidential information memorandum|notice of confidentiality/i.test(
          part
        )
    );
  const useful = parts.filter((part) => BUSINESS_HINT.test(part));
  const chosen = (useful.length ? useful : parts).slice(0, maxSentences);
  return stripLeadingName(chosen.join(" "), deal.name);
}

export function printedConcentration(text: string) {
  const match = text.match(
    /\b(?:top|largest|single)?\s*customer[^.%]{0,40}?(\d{1,2}(?:\.\d+)?)\s*%/i
  );
  return match ? `${match[1]}%` : null;
}

function fact(
  label: string,
  value: string,
  kind: DealPictureFact["kind"],
  source?: string
): DealPictureFact {
  return { label, value, kind, source };
}

function moneyFact(
  label: string,
  listing: number | null | undefined,
  packet: number | null,
  source?: string
): DealPictureFact {
  if (packet != null) {
    return fact(label, money(packet), "CIM_FACT", source);
  }
  if (listing != null) {
    return fact(label, `${money(listing)} (Seller Claim)`, "SELLER_CLAIM");
  }
  return fact(label, unanswered("no printed figure"), "UNANSWERED");
}

function locateMoney(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(
      new RegExp(
        `${label}[^\\d$]{0,24}\\$?\\s*([0-9][0-9,]*(?:\\.\\d+)?)\\s*(m|k|million)?`,
        "i"
      )
    );
    if (!match) continue;
    let value = Number(match[1].replace(/,/g, ""));
    const suffix = (match[2] || "").toLowerCase();
    if (suffix === "k") value *= 1_000;
    if (suffix === "m" || suffix === "million") value *= 1_000_000;
    if (value > 0) return value;
  }
  return null;
}

export function buildDealPicture(deal: Deal): DealPicture {
  const cim = hasReadableCim(deal);
  const text = packetText(deal);
  const cimText = packetText(deal, ["cim"]);
  const close = closeSpeedFor(deal);
  const headline = headlineScore(deal);
  if (!cim) {
    return {
      version: DEAL_PICTURE_VERSION,
      status: "no_cim",
      summary:
        "No CIM on card. This is a listing / teaser screen only — do not underwrite a book that is not here.",
      facts: [
        moneyFact("Asking price", deal.askingPrice, null),
        moneyFact("Revenue", deal.revenue, null),
        moneyFact("SDE", deal.sde, null),
        moneyFact("EBITDA", deal.ebitda, null),
        fact(
          "Close speed",
          close,
          "UNANSWERED",
          "Time-to-close after LOI, not quality."
        ),
      ],
      risks: [],
      unanswered: [
        "CIM / confidential information memorandum",
        "Who pays, and whether any customer % is printed",
        "Owner hours and whether the shop runs without the seller",
        "Whether listed earnings tie to tax returns",
      ],
      rebuiltAt: new Date().toISOString(),
      scoreLabel: headline.label,
      score: headline.score,
      closeSpeed: close,
    };
  }

  const packetAsk = locateMoney(cimText, ["asking price", "sale price", "purchase price"]);
  const packetRev = locateMoney(cimText, ["revenue", "sales", "ttm"]);
  const packetSde = locateMoney(cimText, [
    "sde",
    "seller.?s discretionary",
    "seller discretionary",
    "owner benefit",
  ]);
  const packetEbitda = locateMoney(cimText, ["ebitda"]);
  const ask = packetAsk ?? deal.askingPrice ?? null;
  const earnings = packetSde ?? packetEbitda ?? deal.sde ?? deal.ebitda ?? null;
  const askMultiple = multiple(ask, earnings);
  const concentration = printedConcentration(text);
  const cimEmployees = text.match(
    /\b(\d{1,3})\s*(?:full[\s-]?time\s+)?employees?\b/i
  )?.[1];
  const employees =
    cimEmployees || (deal.employees != null ? String(deal.employees) : null);
  const ownerHours = text.match(
    /\b(?:owner|seller).{0,40}(\d{1,3})\s*(?:hours?\/week|hours a week|hrs\/wk)\b/i
  );
  const recast = /\b(add[\s-]?backs?|recast|adjusted (?:ebitda|sde)|normalized (?:ebitda|sde))\b/i.test(
    text
  );
  const reSplit = /real estate only[^$]{0,12}\$?\s*([0-9,.]+)|business only[^$]{0,12}\$?\s*([0-9,.]+)/i.exec(
    text
  );

  const summary = firstSentences(
    cimProse(deal, 5) ||
      "Seller CIM is on the card, but the extracted text does not yet yield a clean operating description.",
    5
  );

  const risks = [
    recast ? "Listed earnings are recast / add-back math — Seller Claim until tax-tied." : "",
    /customer[\s-]owned (?:molds?|tooling)|customers own their patented molds/i.test(text)
      ? "Customer-owned molds / tooling called out in the CIM."
      : "",
    /government|county government|federal government|set[\s-]?aside|8\(a\)|wbe|mbe/i.test(
      text
    )
      ? "Government / public-sector work is in the CIM — treat close speed as Slow."
      : "",
    /franchise/i.test(text) ? "Franchise language is in the CIM." : "",
    concentration ? `Printed concentration: ${concentration}.` : "",
  ].filter(Boolean);

  const unansweredItems = [
    !concentration ? "Top-customer % — not printed in the CIM" : "",
    !ownerHours ? "Owner hours / who runs a week without the seller" : "",
    recast ? "Tax-return tie-out for recast SDE" : "",
    deal.realEstateIncluded == null ? "Whether real estate is in the ask" : "",
  ].filter(Boolean);

  return {
    version: DEAL_PICTURE_VERSION,
    status: "from_cim",
    summary,
    facts: [
      moneyFact("Asking price", deal.askingPrice, packetAsk, "CIM"),
      moneyFact("Revenue", deal.revenue, packetRev, "CIM"),
      fact(
        "SDE",
        packetSde != null
          ? `${money(packetSde)}${recast ? " (Seller Claim — recast / add-backs)" : ""}`
          : deal.sde != null
            ? `${money(deal.sde)} (Seller Claim)`
            : unanswered("no printed figure"),
        recast || (packetSde == null && deal.sde != null)
          ? "SELLER_CLAIM"
          : packetSde != null
            ? "CIM_FACT"
            : "UNANSWERED",
        recast ? "CIM recast" : packetSde != null ? "CIM" : undefined
      ),
      moneyFact("EBITDA", deal.ebitda, packetEbitda, "CIM"),
      fact(
        "Multiple",
        askMultiple != null ? `${askMultiple.toFixed(1)}x listed earnings` : unanswered("need ask and earnings"),
        askMultiple != null ? "CIM_FACT" : "UNANSWERED"
      ),
      fact(
        "RE vs business",
        reSplit
          ? `CIM split printed (RE / business). Listing RE: ${
              deal.realEstateIncluded === true
                ? "included"
                : deal.realEstateIncluded === false
                  ? "not included"
                  : "unanswered"
            }`
          : deal.realEstateIncluded === true
            ? "Listing says RE included — Seller Claim until a CIM allocation."
            : deal.realEstateIncluded === false
              ? "Listing says no real estate in the ask."
              : unanswered("RE vs business split"),
        reSplit ? "CIM_FACT" : deal.realEstateIncluded == null ? "UNANSWERED" : "SELLER_CLAIM"
      ),
      fact(
        "Employees",
        employees || unanswered("headcount"),
        cimEmployees ? "CIM_FACT" : employees ? "SELLER_CLAIM" : "UNANSWERED"
      ),
      fact(
        "Owner hours",
        ownerHours ? `${ownerHours[1]} hours/week (CIM)` : unanswered("owner hours"),
        ownerHours ? "CIM_FACT" : "UNANSWERED"
      ),
      fact(
        "Concentration",
        concentration || unanswered("no printed customer %"),
        concentration ? "CIM_FACT" : "UNANSWERED"
      ),
      fact(
        "Earnings quality",
        recast
          ? "Recast / add-backs — Seller Claim, not tax-tied"
          : "No recast language printed; still not tax-tied unless a tax/QoE file is on the card",
        recast ? "SELLER_CLAIM" : "UNANSWERED"
      ),
      fact("Close speed", `${close} close`, "CIM_FACT"),
      fact(
        headline.label,
        `${headline.score} / 100`,
        "CIM_FACT"
      ),
    ],
    risks,
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
  if (!deal.notes) return summary || deal.notes;
  if (looksLikeOcrDump(deal.notes) || /^[A-Z][^.]*LLC|^[A-Z].{0,40}appears to/i.test(deal.notes)) {
    return firstSentences(summary || stripLeadingName(deal.notes, deal.name), 4);
  }
  return deal.notes;
}
