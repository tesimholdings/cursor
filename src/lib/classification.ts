import { closeSpeedFor } from "./close-speed";
import type {
  AssetProfile,
  BoxFit,
  BusinessCategory,
  Deal,
  EarningsQuality,
  OperatingStyle,
  RecordTag,
  RiskSnapshot,
} from "./types";

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  "Gas / C-store",
  "Car wash",
  "RV / MH park",
  "Laundromat / lube",
  "Plastic / injection molding",
  "Metal / fabrication / machine shop",
  "Painting / coatings",
  "Construction / trades",
  "Trucking / logistics",
  "Distribution / wholesale",
  "Industrial equipment / manufacturing other",
  "Other",
  "Unknown",
];

export const OPERATING_STYLES: OperatingStyle[] = [
  "Hands-off",
  "Hands-on",
  "Mixed",
];

export const RISK_SNAPSHOTS: RiskSnapshot[] = [
  "Safer",
  "Mixed",
  "Riskier",
  "Unknown",
];

export const ASSET_PROFILES: AssetProfile[] = [
  "Asset-heavy",
  "Asset-light",
  "Unknown",
];

export const BOX_FITS: BoxFit[] = [
  "In-box",
  "Stretch",
  "Too small",
  "Too big",
  "Unknown",
];

export const EARNINGS_QUALITIES: EarningsQuality[] = [
  "Tax-tied",
  "Recast",
  "Unverified",
];

export { CLOSE_SPEEDS } from "./close-speed";

function dealText(deal: Pick<Deal, "name" | "industry" | "notes">) {
  return `${deal.name} ${deal.industry} ${deal.notes || ""}`.toLowerCase();
}

export function categorizeDeal(
  deal: Pick<Deal, "name" | "industry" | "notes">
): BusinessCategory {
  const text = dealText(deal);
  if (/\buniquecoat technologies\b/.test(text)) {
    return "Industrial equipment / manufacturing other";
  }
  if (
    /\b(c[\s-]?stores?|convenience stores?|gas stations?|fuel stations?|petroleum marketer|fuel retail)\b/.test(
      text
    )
  )
    return "Gas / C-store";
  if (/\b(car washes?|auto washes?|vehicle washes?)\b/.test(text))
    return "Car wash";
  if (
    /\b(rv parks?|rv resorts?|mobile home parks?|manufactured housing communit(?:y|ies)|mh parks?)\b/.test(
      text
    )
  )
    return "RV / MH park";
  if (/\b(laundromats?|coin laundr(?:y|ies)|self service laundr(?:y|ies)|quick lubes?|oil change|lube shops?)\b/.test(text))
    return "Laundromat / lube";
  if (
    /\b(injection mold|injection molding|plastic mold|plastics? manufacturer|thermoplastic)\b/.test(
      text
    )
  )
    return "Plastic / injection molding";
  if (
    /\b(cnc|machine shop|machining|metal fabricat|tool(?:\s*&\s*|\s+and\s+)die|tooling shop|welding|sheet metal|metal stamp)\b/.test(
      text
    )
  )
    return "Metal / fabrication / machine shop";
  if (
    /\b(painting|paint contractor|powder coat|coatings?|industrial finish|surface finish|surface treatment)\b/.test(
      text
    )
  )
    return "Painting / coatings";
  if (
    /\b(construction|contractor|electrical|electrician|hvac|plumbing|roofing|carpentry|cabinet|concrete|excavat)\b/.test(
      text
    )
  )
    return "Construction / trades";
  if (
    /\b(trucking|freight|logistics|transportation|last mile|delivery fleet|warehousing)\b/.test(
      text
    )
  )
    return "Trucking / logistics";
  if (
    /\b(distribution|distributor|wholesale|wholesaler|foodservice supply|industrial supply)\b/.test(
      text
    )
  )
    return "Distribution / wholesale";
  if (
    /\b(manufactur(?:e|er|ers|ing)?|industrial equipment|factory|production|packaging|assembly|equipment maker)\b/.test(
      text
    )
  )
    return "Industrial equipment / manufacturing other";

  const industry = deal.industry.trim().toLowerCase();
  const generic = new Set(["", "unknown", "not provided", "n/a", "other"]);
  return generic.has(industry) ? "Unknown" : "Other";
}

function fullEvidenceText(deal: Deal) {
  const documentText = deal.documents
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
  const researchText =
    deal.publicResearch?.status === "complete"
      ? deal.publicResearch.sources
          .map((source) => source.excerpt || "")
          .join(" ")
      : "";
  return normalizeDealSearch(
    [
      deal.name,
      deal.industry,
      deal.notes,
      documentText,
      researchText,
      ...deal.fatalRisks,
      ...(deal.diligence?.fatalRisks || []),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function recordTagFor(deal: Deal): RecordTag {
  return deal.batchId === "batch_seed" || deal.source === "Seed list"
    ? "Seed / Demo"
    : "Live";
}

/** Seed / demo rows stay in the store but never appear on the live board. */
export function isHiddenSample(deal: Pick<Deal, "batchId" | "source" | "id">) {
  return (
    deal.batchId === "batch_seed" ||
    deal.source === "Seed list" ||
    deal.id === "deal_mighty"
  );
}

export function boxFitFor(deal: Deal): BoxFit {
  const ask = deal.askingPrice;
  if (ask == null || !Number.isFinite(ask) || ask <= 0) return "Unknown";
  // Uniquecoat's $4.95M listing is treated as in-box rather than creating a
  // false precision cliff at exactly $5M.
  if (ask >= 4_500_000 && ask <= 10_500_000) return "In-box";
  if (ask >= 2_500_000 && ask < 4_500_000) return "Stretch";
  if (ask > 10_500_000 && ask <= 15_000_000) return "Stretch";
  return ask < 2_500_000 ? "Too small" : "Too big";
}

export function assetProfileFor(
  deal: Deal,
  category = categorizeDeal(deal),
  evidence = fullEvidenceText(deal)
): AssetProfile {
  const ffeShare =
    deal.ffe != null && deal.askingPrice
      ? deal.ffe / deal.askingPrice
      : null;
  const materialFfe =
    deal.ffe != null &&
    (ffeShare != null ? ffeShare >= 0.15 : deal.ffe >= 500_000);
  if (
    deal.realEstateIncluded === true ||
    materialFfe ||
    /\b(asset[\s-]?heavy|owned real estate|real estate is owned|owns? (?:an? |the )?(?:office|warehouse|facility|property)|real estate.{0,50}available for acquisition)\b/.test(
      evidence
    )
  ) {
    return "Asset-heavy";
  }
  if (
    /\b(asset[\s-]?light|heavy equipment.{0,30}rented|equipment.{0,30}rented|rented iron|subcontract(?:or|ed|ing)?)\b/.test(
      evidence
    ) ||
    ["Painting / coatings", "Construction / trades"].includes(category)
  ) {
    return "Asset-light";
  }
  return "Unknown";
}

export function earningsQualityFor(
  deal: Deal,
  evidence = fullEvidenceText(deal)
): EarningsQuality {
  if (
    /\b(tax[\s-]?tied|tax (?:returns?|obi).{0,40}(?:tie|match|reconcil|support)|(?:tie|match|reconcil).{0,40}tax returns?|ordinary business income.{0,40}(?:tie|match|reconcil))\b/.test(
      evidence
    )
  ) {
    return "Tax-tied";
  }
  if (
    deal.name === "Mighty Molding and Manufacturing" ||
    /\b(add[\s-]?backs?|recast|adjusted (?:ebitda|sde)|normalized (?:ebitda|sde))\b/.test(
      evidence
    )
  ) {
    return "Recast";
  }
  return "Unverified";
}

function hasConcentrationRisk(deal: Deal, evidence: string) {
  return (
    deal.name === "Mighty Molding and Manufacturing" ||
    ["HIGH", "MEDIUM_HIGH"].includes(
      deal.diligence?.concentrationFlag || ""
    ) ||
    /\b(high customer concentration|customer concentration.{0,30}\d+(?:\.\d+)?%|(?:top|largest) customer.{0,30}\d+(?:\.\d+)?%)\b/.test(
      evidence
    ) ||
    [...deal.fatalRisks, ...(deal.diligence?.fatalRisks || [])].some(
      (risk) => /customer concentration/i.test(risk)
    )
  );
}

export function riskSnapshotFor(
  deal: Deal,
  category = categorizeDeal(deal),
  assetProfile = assetProfileFor(deal, category),
  boxFit = boxFitFor(deal),
  earningsQuality = earningsQualityFor(deal),
  evidence = fullEvidenceText(deal)
): RiskSnapshot {
  if (recordTagFor(deal) === "Seed / Demo") return "Unknown";
  const concentration = hasConcentrationRisk(deal, evidence);
  const ownerKeyPerson =
    /\b(owner[\s-]?(?:dependent|dependence|operated)|key[\s-]?person|owner.{0,30}(?:handles|controls|relationship))\b/.test(
      evidence
    );
  const discretionary =
    /\b(discretionary demand|luxury|nonessential|non-essential)\b/.test(
      evidence
    );
  const boringHandsOff = [
    "Gas / C-store",
    "Car wash",
    "RV / MH park",
    "Laundromat / lube",
  ].includes(category);

  if (boringHandsOff && !concentration && !ownerKeyPerson && !discretionary) {
    return "Safer";
  }
  if (
    concentration ||
    ["Painting / coatings", "Construction / trades"].includes(category) ||
    discretionary ||
    (assetProfile === "Asset-light" && ownerKeyPerson) ||
    (assetProfile === "Asset-light" && earningsQuality === "Recast")
  ) {
    return "Riskier";
  }
  if (
    [
      "Plastic / injection molding",
      "Metal / fabrication / machine shop",
      "Industrial equipment / manufacturing other",
    ].includes(category) &&
    (deal.askingPrice != null ||
      assetProfile !== "Unknown" ||
      earningsQuality === "Recast")
  ) {
    return "Mixed";
  }
  if (
    (boxFit === "Too small" || boxFit === "Too big") &&
    (ownerKeyPerson || earningsQuality === "Recast")
  ) {
    return "Riskier";
  }
  return "Unknown";
}

export function operatingStyleFor(
  deal: Pick<Deal, "name" | "industry" | "notes">,
  category = categorizeDeal(deal)
): OperatingStyle {
  if (
    [
      "Gas / C-store",
      "Car wash",
      "RV / MH park",
      "Laundromat / lube",
    ].includes(category)
  ) {
    return "Hands-off";
  }

  const text = dealText(deal);
  // Mixed is never the fallback. It requires an explicit management/absentee
  // signal in a business that would otherwise be operationally hands-on.
  if (
    /\b(semi[\s-]?absentee|absentee owner|manager[\s-]?run|general manager in place|management team in place)\b/.test(
      text
    )
  ) {
    return "Mixed";
  }
  return "Hands-on";
}

export function classifyDeal(deal: Deal) {
  const businessCategory = categorizeDeal(deal);
  const operatingStyleTags = [operatingStyleFor(deal, businessCategory)];
  const evidence = fullEvidenceText(deal);
  const assetProfile = assetProfileFor(deal, businessCategory, evidence);
  const boxFit = boxFitFor(deal);
  const earningsQuality = earningsQualityFor(deal, evidence);
  const riskSnapshot = riskSnapshotFor(
    deal,
    businessCategory,
    assetProfile,
    boxFit,
    earningsQuality,
    evidence
  );
  const recordTag = recordTagFor(deal);
  return {
    businessCategory,
    operatingStyleTags,
    riskSnapshot,
    assetProfile,
    boxFit,
    earningsQuality,
    recordTag,
  };
}

export function ensureDealClassification(deal: Deal): boolean {
  const classification = classifyDeal(deal);
  const changed =
    deal.businessCategory !== classification.businessCategory ||
    deal.operatingStyleTags?.length !== 1 ||
    deal.operatingStyleTags[0] !== classification.operatingStyleTags[0] ||
    deal.riskSnapshot !== classification.riskSnapshot ||
    deal.assetProfile !== classification.assetProfile ||
    deal.boxFit !== classification.boxFit ||
    deal.earningsQuality !== classification.earningsQuality ||
    deal.recordTag !== classification.recordTag;
  if (changed) {
    deal.businessCategory = classification.businessCategory;
    deal.operatingStyleTags = classification.operatingStyleTags;
    deal.riskSnapshot = classification.riskSnapshot;
    deal.assetProfile = classification.assetProfile;
    deal.boxFit = classification.boxFit;
    deal.earningsQuality = classification.earningsQuality;
    deal.recordTag = classification.recordTag;
  }
  const closeSpeed = closeSpeedFor(deal);
  const speedChanged = deal.closeSpeed !== closeSpeed;
  if (speedChanged) deal.closeSpeed = closeSpeed;
  return changed || speedChanged;
}

export function ensureStoreClassifications(deals: Deal[]): boolean {
  return deals.reduce(
    (changed, deal) => ensureDealClassification(deal) || changed,
    false
  );
}

export function normalizeDealSearch(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function dealMatchesSearch(deal: Deal, query: string) {
  const needle = normalizeDealSearch(query);
  if (!needle) return true;
  const computed = classifyDeal(deal);
  const category = deal.businessCategory || computed.businessCategory;
  const classification = {
    businessCategory: category,
    operatingStyleTags:
      deal.operatingStyleTags || computed.operatingStyleTags,
    riskSnapshot: deal.riskSnapshot || computed.riskSnapshot,
    assetProfile: deal.assetProfile || computed.assetProfile,
    boxFit: deal.boxFit || computed.boxFit,
    earningsQuality: deal.earningsQuality || computed.earningsQuality,
    recordTag: deal.recordTag || computed.recordTag,
  };
  const closeSpeed = deal.closeSpeed || closeSpeedFor(deal);
  const haystack = normalizeDealSearch(
    [
      deal.name,
      deal.industry,
      classification.businessCategory,
      deal.location,
      deal.state,
      deal.broker,
      deal.source,
      ...classification.operatingStyleTags,
      classification.riskSnapshot,
      classification.assetProfile,
      classification.boxFit,
      classification.earningsQuality,
      classification.recordTag,
      closeSpeed,
      `${closeSpeed} close`,
      "close speed",
    ]
      .filter(Boolean)
      .join(" ")
  );
  return haystack.includes(needle);
}
