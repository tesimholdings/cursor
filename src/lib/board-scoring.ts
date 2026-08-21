import { classifyDeal } from "./classification";
import type {
  BoardScores,
  BoardSubScore,
  Deal,
  DiligencePack,
} from "./types";

/** Purchase-value weights for the six listing subs. Missing subs are dropped and the rest renormalized. */
export const BOARD_PURCHASE_VALUE_WEIGHTS = {
  financials: 30,
  assets: 20,
  owner: 15,
  safety: 15,
  handsOff: 10,
  growth: 10,
} as const;

export type BoardSubKey = keyof typeof BOARD_PURCHASE_VALUE_WEIGHTS;

export const BOARD_SUB_KEYS = Object.keys(
  BOARD_PURCHASE_VALUE_WEIGHTS
) as BoardSubKey[];

/**
 * IC pillars stay on their stored evidence maxes; the headline rescales each
 * pillar to the purchase-value weight so old Full IC packs pick up the new mix
 * without rewriting seller numbers.
 */
export const IC_PURCHASE_VALUE_PILLARS = [
  { key: "financial", label: "Financial quality", max: 20, weight: 25 },
  { key: "customer", label: "Customer / revenue quality", max: 15, weight: 20 },
  { key: "operations", label: "Operations", max: 15, weight: 15 },
  { key: "assets", label: "Asset / downside", max: 10, weight: 12 },
  { key: "dealStructure", label: "Deal structure / financing", max: 10, weight: 10 },
  { key: "growth", label: "Growth", max: 15, weight: 8 },
  { key: "tax", label: "Tax efficiency", max: 10, weight: 5 },
  { key: "legal", label: "Legal / reg / env", max: 5, weight: 5 },
] as const;

export function weightedScore(
  parts: Array<{ score?: number | null; weight: number }>
): number {
  let weighted = 0;
  let weightSum = 0;
  for (const part of parts) {
    if (part.score == null || !Number.isFinite(part.score) || part.weight <= 0) {
      continue;
    }
    weighted += part.score * part.weight;
    weightSum += part.weight;
  }
  if (weightSum <= 0) return 0;
  return Math.round(weighted / weightSum);
}

export function purchaseValueAverage(
  scores: Pick<BoardScores, BoardSubKey>
): number {
  return weightedScore(
    BOARD_SUB_KEYS.map((key) => ({
      score: scores[key]?.score,
      weight: BOARD_PURCHASE_VALUE_WEIGHTS[key],
    }))
  );
}

export function equalWeightAverage(
  scores: Pick<BoardScores, BoardSubKey>
): number {
  const present = BOARD_SUB_KEYS.map((key) => scores[key]?.score).filter(
    (score): score is number => score != null && Number.isFinite(score)
  );
  if (!present.length) return 0;
  return Math.round(
    present.reduce((sum, score) => sum + score, 0) / present.length
  );
}

export function icHeadlineScore(scores: DiligencePack["scores"]): number {
  return weightedScore(
    IC_PURCHASE_VALUE_PILLARS.map((pillar) => {
      const raw = scores[pillar.key];
      if (raw == null || !Number.isFinite(raw) || pillar.max <= 0) {
        return { score: null, weight: pillar.weight };
      }
      const bounded = Math.max(0, Math.min(raw, pillar.max));
      return {
        score: (bounded / pillar.max) * 100,
        weight: pillar.weight,
      };
    })
  );
}

export function icPillarContribution(
  score: number,
  max: number,
  weight: number
): number {
  if (max <= 0) return 0;
  const bounded = Math.max(0, Math.min(score, max));
  return Math.round((bounded / max) * weight);
}

export type BoardScoreMetric =
  | "average"
  | "financials"
  | "owner"
  | "growth"
  | "handsOff"
  | "safety"
  | "assets";

export const BOARD_SCORE_METRICS: Array<{
  key: BoardScoreMetric;
  label: string;
}> = [
  { key: "average", label: "Purchase value" },
  { key: "financials", label: "Financials" },
  { key: "owner", label: "Owner" },
  { key: "growth", label: "Growth" },
  { key: "handsOff", label: "Hands-off" },
  { key: "safety", label: "Safety" },
  { key: "assets", label: "Assets" },
];

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function evidenceText(deal: Deal) {
  const documents = deal.documents
    .map(
      (document) =>
        document.textExcerpt ||
        document.extraction?.chunks
          .map((chunk) => chunk.text)
          .join(" ")
          .slice(0, 20_000) ||
        ""
    )
    .join(" ");
  const research =
    deal.publicResearch?.status === "complete"
      ? deal.publicResearch.sources
          .map((source) => source.excerpt || "")
          .join(" ")
      : "";
  return `${deal.notes || ""} ${documents} ${research}`
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function financialScore(deal: Deal): BoardSubScore {
  const tags = classifyDeal(deal);
  const earnings = deal.sde ?? deal.ebitda;
  const hasAsk = deal.askingPrice != null && deal.askingPrice > 0;
  const hasRevenue = deal.revenue != null && deal.revenue > 0;
  const hasEarnings = earnings != null && earnings > 0;
  let score = 10;
  if (hasAsk) score += 10;
  if (hasRevenue) score += 10;
  if (hasEarnings) score += 10;

  score +=
    tags.earningsQuality === "Tax-tied"
      ? 25
      : tags.earningsQuality === "Recast"
        ? 8
        : 0;
  score +=
    tags.boxFit === "In-box"
      ? 15
      : tags.boxFit === "Stretch"
        ? 5
        : tags.boxFit === "Too small" || tags.boxFit === "Too big"
          ? -5
          : 0;

  const listingMultiple =
    hasAsk && hasEarnings ? deal.askingPrice! / earnings! : null;
  if (listingMultiple != null) {
    const multipleBand =
      listingMultiple <= 3.5 ? "lower" : listingMultiple <= 5 ? "middle" : "higher";
    if (multipleBand === "lower") {
      score +=
        tags.earningsQuality === "Tax-tied"
          ? 20
          : tags.earningsQuality === "Recast"
            ? 8
            : 3;
    } else if (multipleBand === "middle") {
      score +=
        tags.earningsQuality === "Tax-tied"
          ? 10
          : tags.earningsQuality === "Recast"
            ? 4
            : 0;
    } else {
      score -= 10;
    }
  }

  const missing = [
    !hasAsk ? "ask" : "",
    !hasRevenue ? "revenue" : "",
    !hasEarnings ? "earnings" : "",
  ].filter(Boolean);
  const why = missing.length
    ? `Missing ${missing.join(", ")}. Earnings quality is ${tags.earningsQuality}; box fit is ${tags.boxFit}.`
    : `Listing math is available. Earnings quality is ${tags.earningsQuality}; box fit is ${tags.boxFit}.`;
  return {
    score: clamp(score),
    why,
    unknown: missing.length > 0 || tags.earningsQuality === "Unverified",
  };
}

function ownerScore(deal: Deal, text: string): BoardSubScore {
  const managerEvidence =
    /\b(reduced owner dependency|manager[\s-]?run|general manager in place|management team in place|project manager in place|pm in place|semi[\s-]?absentee|absentee)\b/.test(
      text
    );
  const ownerStuck =
    /\b(owner[\s-]?(?:dependent|dependence|operated)|key[\s-]?person|owner on the tools|owner.{0,35}(?:handles|controls|relationship))\b/.test(
      text
    );
  if (managerEvidence) {
    return {
      score: 80,
      why: "Seller material states manager coverage or reduced owner dependence; transferability still needs verification.",
      unknown: false,
    };
  }
  if (ownerStuck) {
    return {
      score: 20,
      why: "Seller material indicates owner or key-person dependence.",
      unknown: false,
    };
  }
  return {
    score: 40,
    why: "Owner duties, weekly hours, and transferability are not established.",
    unknown: true,
  };
}

function growthScore(deal: Deal, text: string): BoardSubScore {
  const statedGrowthEvidence =
    /\b(backlog|recurring revenue|contracted revenue|expansion potential|repeat customers?|sales pipeline)\b/.test(
      text
    );
  const capacityEvidence =
    /\b(available capacity|capacity utilization.{0,20}\d|utilization.{0,20}\d|measured capacity|open capacity)\b/.test(
      text
    );
  const concentration =
    ["HIGH", "MEDIUM_HIGH"].includes(
      deal.diligence?.concentrationFlag || ""
    ) ||
    [...deal.fatalRisks, ...(deal.diligence?.fatalRisks || [])].some((risk) =>
      /customer concentration/i.test(risk)
    );
  let score = 40;
  if (statedGrowthEvidence) score += 10;
  if (capacityEvidence) score += 15;
  if (concentration) score -= 15;
  if (!capacityEvidence) score = Math.min(score, 55);
  return {
    score: clamp(score),
    why: capacityEvidence
      ? "Seller material states capacity evidence; demand and contribution margin still require proof."
      : "Realistic capacity is unknown, so growth is capped rather than underwriting a 2x story.",
    unknown: !capacityEvidence,
  };
}

function handsOffScore(deal: Deal, text: string): BoardSubScore {
  const tags = classifyDeal(deal);
  const style = tags.operatingStyleTags[0];
  const ownerOnTools =
    /\b(owner on the tools|owner.{0,30}(?:performs|paints|operates|repairs|handles daily))\b/.test(
      text
    );
  if (ownerOnTools) {
    return {
      score: 10,
      why: "Seller material indicates the owner remains on the tools or in daily execution.",
      unknown: false,
    };
  }
  if (style === "Hands-off") {
    return {
      score: 85,
      why: "The business category is one of TESIM's Hands-off operating styles; actual owner hours remain to be confirmed.",
      unknown: true,
    };
  }
  if (style === "Mixed") {
    return {
      score: 60,
      why: "The listing contains both operating involvement and management/absentee signals.",
      unknown: true,
    };
  }
  return {
    score: 25,
    why: "This category normally requires hands-on operating oversight; actual management depth remains to be verified.",
    unknown: true,
  };
}

function safetyScore(deal: Deal): BoardSubScore {
  const risk = deal.riskSnapshot || classifyDeal(deal).riskSnapshot;
  const scores = { Safer: 82, Mixed: 55, Riskier: 25, Unknown: 40 } as const;
  return {
    score: scores[risk],
    why:
      risk === "Unknown"
        ? "Safety facts are incomplete; no diversification, concentration, or utilization is assumed."
        : `Aligned to the evidence-bounded ${risk} risk snapshot shown on the board.`,
    unknown: risk === "Unknown",
  };
}

function assetsScore(deal: Deal): BoardSubScore {
  const tags = classifyDeal(deal);
  if (tags.assetProfile === "Asset-light") {
    return {
      score: 20,
      why: "The listing/CIM describes an asset-light, rented, subcontracted, painting, or construction model.",
      unknown: false,
    };
  }
  if (tags.assetProfile === "Unknown") {
    return {
      score: 35,
      why: "Owned real estate, material FF&E, and asset coverage versus ask are not established.",
      unknown: true,
    };
  }
  if (deal.realEstateIncluded === true) {
    return {
      score: 80,
      why: "The listing says real estate is included; value and condition still require verification.",
      unknown: false,
    };
  }
  if (deal.ffe != null && deal.askingPrice) {
    const coverage = deal.ffe / deal.askingPrice;
    return {
      score: coverage >= 0.3 ? 80 : coverage >= 0.15 ? 65 : 50,
      why: "Seller-stated FF&E provides measurable ask coverage, but it is not an appraisal.",
      unknown: false,
    };
  }
  return {
    score: 60,
    why: "Seller material indicates owned or acquisition-available assets, but ask coverage is not fully quantified.",
    unknown: true,
  };
}

export function buildBoardScores(deal: Deal): BoardScores {
  const text = evidenceText(deal);
  const scores = {
    financials: financialScore(deal),
    owner: ownerScore(deal, text),
    growth: growthScore(deal, text),
    handsOff: handsOffScore(deal, text),
    safety: safetyScore(deal),
    assets: assetsScore(deal),
  };
  const average = purchaseValueAverage(scores);
  return { average, ...scores };
}

export function ensureDealBoardScores(deal: Deal): boolean {
  const next = buildBoardScores(deal);
  if (JSON.stringify(deal.boardScores) === JSON.stringify(next)) return false;
  deal.boardScores = next;
  return true;
}

export function ensureStoreBoardScores(deals: Deal[]): boolean {
  return deals.reduce(
    (changed, deal) => ensureDealBoardScores(deal) || changed,
    false
  );
}

export function boardScoresFor(deal: Deal) {
  return deal.boardScores || buildBoardScores(deal);
}

export function boardScoreValue(
  deal: Deal,
  metric: BoardScoreMetric
): number {
  const scores = boardScoresFor(deal);
  return metric === "average" ? scores.average : scores[metric].score;
}

export function headlineScore(deal: Deal) {
  const board = boardScoresFor(deal);
  if (deal.diligence) {
    return {
      label: "IC score" as const,
      score: icHeadlineScore(deal.diligence.scores),
      boardAverage: board.average,
    };
  }
  return {
    label: "Board score" as const,
    score: board.average,
    boardAverage: board.average,
  };
}

export type HeadlineSort = "best" | "worst";

/** The number the deal card already shows, or null when that rank is missing. */
export function headlineRankValue(deal: Deal): number | null {
  const score = headlineScore(deal).score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

export function compareDealsByHeadline(
  a: Deal,
  b: Deal,
  sort: HeadlineSort
): number {
  const aScore = headlineRankValue(a);
  const bScore = headlineRankValue(b);
  const aMissing = aScore == null;
  const bMissing = bScore == null;
  if (aMissing !== bMissing) {
    if (sort === "best") return aMissing ? 1 : -1;
    return aMissing ? -1 : 1;
  }
  if (!aMissing && !bMissing && aScore !== bScore) {
    return sort === "best" ? bScore - aScore : aScore - bScore;
  }
  return a.name.localeCompare(b.name);
}

export function sortDealsByHeadline(deals: Deal[], sort: HeadlineSort): Deal[] {
  return [...deals].sort((a, b) => compareDealsByHeadline(a, b, sort));
}
