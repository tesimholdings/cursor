import type {
  BusinessCategory,
  Deal,
  OperatingStyle,
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

function dealText(deal: Pick<Deal, "name" | "industry" | "notes">) {
  return `${deal.name} ${deal.industry} ${deal.notes || ""}`.toLowerCase();
}

export function categorizeDeal(
  deal: Pick<Deal, "name" | "industry" | "notes">
): BusinessCategory {
  const text = dealText(deal);
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
    /\b(painting|paint contractor|powder coat|coatings?|industrial finish|surface finish|thermal spray|surface treatment|uniquecoat)\b/.test(
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
  return { businessCategory, operatingStyleTags };
}

export function ensureDealClassification(deal: Deal): boolean {
  const classification = classifyDeal(deal);
  const changed =
    deal.businessCategory !== classification.businessCategory ||
    deal.operatingStyleTags?.length !== 1 ||
    deal.operatingStyleTags[0] !== classification.operatingStyleTags[0];
  if (changed) {
    deal.businessCategory = classification.businessCategory;
    deal.operatingStyleTags = classification.operatingStyleTags;
  }
  return changed;
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
  const category = deal.businessCategory || categorizeDeal(deal);
  const classification = {
    businessCategory: category,
    operatingStyleTags:
      deal.operatingStyleTags ||
      [operatingStyleFor(deal, category)],
  };
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
    ]
      .filter(Boolean)
      .join(" ")
  );
  return haystack.includes(needle);
}
