import {
  boxFitFor,
  categorizeDeal,
  earningsQualityFor,
  recordTagFor,
} from "./classification";
import type { BusinessCategory, CloseSpeed, Deal } from "./types";

export const CLOSE_SPEEDS: CloseSpeed[] = ["Fast", "Mid", "Slow"];

export interface CloseSpeedResult {
  speed: CloseSpeed;
  reasons: string[];
}

function speedEvidence(deal: Deal) {
  const documents = deal.documents
    .map(
      (document) =>
        `${document.name} ${document.category} ${
          document.textExcerpt ||
          document.extraction?.chunks
            .map((chunk) => chunk.text)
            .join(" ")
            .slice(0, 12_000) ||
          ""
        }`
    )
    .join(" ");
  const research =
    deal.publicResearch?.status === "complete"
      ? deal.publicResearch.sources
          .map((source) => source.excerpt || "")
          .join(" ")
      : "";
  return `${deal.name} ${deal.industry} ${deal.notes || ""} ${deal.location} ${
    deal.businessCategory || ""
  } ${deal.diligence?.realEstateNotes || ""} ${deal.diligence?.concentrationNote || ""} ${[
    ...deal.fatalRisks,
    ...(deal.diligence?.fatalRisks || []),
    ...(deal.diligence?.findings.sellerClaims || []),
    ...(deal.diligence?.findings.verifiedFacts || []),
  ].join(" ")} ${documents} ${research}`
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function hasLegalEntityName(name: string) {
  return /\b(llc|l\.l\.c\.?|inc\.?|incorporated|corp\.?|corporation|ltd\.?|limited|lp|llp|plc|company|co\.)\b/i.test(
    name
  );
}

export function isSeedDeal(deal: Deal) {
  return (
    recordTagFor(deal) === "Seed / Demo" ||
    deal.recordTag === "Seed / Demo" ||
    deal.batchId === "batch_seed" ||
    deal.source === "Seed list"
  );
}

export function looksUnnamed(deal: Deal) {
  const name = deal.name.trim();
  if (!name) return true;
  if (
    /\b(unnamed|confidential(?:\s+seller)?|tbd|unclassified|seller name withheld)\b/i.test(
      name
    )
  ) {
    return true;
  }
  return /\bportfolio\b/i.test(name) && !hasLegalEntityName(name);
}

export function identityLocked(deal: Deal) {
  return !isSeedDeal(deal) && !looksUnnamed(deal);
}

function isEnvironmentalCategory(
  deal: Deal,
  category: BusinessCategory,
  evidence: string
) {
  if (category === "Gas / C-store") return true;
  if (category === "Car wash" && deal.realEstateIncluded === true) return true;
  return /\b(chemical manufacturing|chemical plant|specialty chemicals|hazardous chemicals)\b/.test(
    evidence
  );
}

function isSmallSimple(deal: Deal) {
  const box = deal.boxFit || boxFitFor(deal);
  if (box === "Too small") return true;
  return (
    deal.askingPrice != null &&
    Number.isFinite(deal.askingPrice) &&
    deal.askingPrice > 0 &&
    deal.askingPrice < 2_500_000
  );
}

function earningsAllowFast(deal: Deal) {
  const quality = deal.earningsQuality || earningsQualityFor(deal);
  if (quality === "Tax-tied") return true;
  if (quality !== "Recast") return true;
  return isSmallSimple(deal);
}

function realEstateAllowsFast(
  deal: Deal,
  category: BusinessCategory,
  evidence: string
) {
  if (deal.realEstateIncluded === false) return true;
  if (
    deal.realEstateIncluded === true &&
    !isEnvironmentalCategory(deal, category, evidence)
  ) {
    return true;
  }
  return false;
}

function slowFlags(
  deal: Deal,
  category: BusinessCategory,
  evidence: string
): string[] {
  const reasons: string[] = [];
  if (
    /\b(government contractor|gov(?:ernment)?(?:\s+contract(?:or|ing|s)?)?|gsa schedule|novation|dfars|\bfar\b|set[\s-]?aside|8\(a\)|hubzone|sdvosb|service[\s-]?disabled veteran|mbe\b|wbe\b|wosb|disadvantaged business|bonding[\s-]?novation|federal contract|municipal contract)\b/.test(
      evidence
    )
  ) {
    reasons.push(
      "Government / set-aside / bonding-novation path (often 3–6 months)."
    );
  }
  if (
    /\b(open (?:legal|litigation|lawsuit|complaint)|pending (?:lawsuit|litigation)|utc\b|osha (?:complaint|citation|violation|fine)|environmental (?:complaint|citation|violation)|epa (?:complaint|citation|violation)|consent decree)\b/.test(
      evidence
    )
  ) {
    reasons.push("Open legal, UTC, OSHA, or environmental complaint.");
  }
  if (
    /\b(franchise(?:e|or)? transfer|franchise agreement|is a franchise|franchised (?:business|operator))\b/.test(
      evidence
    )
  ) {
    reasons.push("Franchise transfer.");
  }
  if (
    /\b(customer[\s-]owned (?:molds?|tooling|tools|dies|fixtures)|customers? own (?:the )?(?:molds?|tooling)|tooling owned by (?:the )?customer)\b/.test(
      evidence
    )
  ) {
    reasons.push("Customer-owned molds / tooling.");
  }
  if (category === "Gas / C-store") {
    reasons.push("Gas / c-store — Phase I default and often Phase II.");
  }
  if (category === "Car wash" && deal.realEstateIncluded === true) {
    reasons.push("Car wash with real estate — Phase I / II environmental path.");
  }
  if (
    /\b(chemical manufacturing|chemical plant|specialty chemicals|hazardous chemicals)\b/.test(
      evidence
    )
  ) {
    reasons.push("Chemical manufacturing — environmental diligence.");
  }
  if (
    /\b(construction wip|wip schedule|percent complete|entitled lots?|lots? (?:still )?(?:in |under )?entitlement|homebuilder lots?|spec homes?)\b/.test(
      evidence
    ) ||
    (category === "Construction / trades" &&
      /\b(wip|entitlement|lots?)\b/.test(evidence))
  ) {
    reasons.push("Construction WIP or lots still in entitlement.");
  }
  if (
    /\b(?:[5-9]|[1-9]\d+)\s+(?:stores?|locations?|sites?|units|stations)\b/.test(
      evidence
    ) ||
    /\b(?:multi[\s-]?site|five or more (?:stores?|locations?))\b/.test(evidence)
  ) {
    reasons.push("Multi-site portfolio (5+ stores / sites).");
  }
  if (looksUnnamed(deal) && deal.realEstateIncluded === true) {
    reasons.push("Unnamed legal entity plus real estate.");
  }
  if (
    /\b(paula\b.{0,40}wbe|wbe\b.{0,40}paula|personal cgc|cgc (?:license )?(?:is |sits )?on|contractor(?:'s)? license.{0,30}(?:personal|owner|seller|individual)|license.{0,20}sits on.{0,20}(?:person|owner|seller|founder)|founder(?:'s)? ip|certs?(?:ifications?)? sit on)\b/.test(
      evidence
    )
  ) {
    reasons.push("Certification or license sits on a named person.");
  }
  return reasons;
}

export function closeSpeedFor(deal: Deal): CloseSpeed {
  return closeSpeedResult(deal).speed;
}

export function closeSpeedResult(deal: Deal): CloseSpeedResult {
  const category = deal.businessCategory || categorizeDeal(deal);
  const evidence = speedEvidence(deal);
  const reasons = slowFlags(deal, category, evidence);

  if (isSeedDeal(deal)) {
    return {
      speed: "Slow",
      reasons: ["Seed / demo — you cannot buy a company that is not live.", ...reasons],
    };
  }

  if (reasons.length) {
    return { speed: "Slow", reasons };
  }

  if (
    identityLocked(deal) &&
    realEstateAllowsFast(deal, category, evidence) &&
    earningsAllowFast(deal)
  ) {
    return {
      speed: "Fast",
      reasons: [
        "Named operating company, no Slow flags, clean or simple RE, and earnings that do not force a long QoE.",
      ],
    };
  }

  if (looksUnnamed(deal)) {
    if (deal.broker || deal.listingUrl) {
      return {
        speed: "Mid",
        reasons: [
          "Live listing with a broker path but no locked legal name — not Fast.",
        ],
      };
    }
    return {
      speed: "Slow",
      reasons: ["Unnamed listing without a broker path — you cannot buy a company you cannot name."],
    };
  }

  return {
    speed: "Mid",
    reasons: [
      "Named operating company on a normal CIM / QoE / bank path (~60–90 days).",
    ],
  };
}
