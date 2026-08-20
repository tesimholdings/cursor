import type { Deal, EvidencePoint, PacketReview, TrafficLight } from "./types";
import { money } from "./format";
import { scorePacket } from "./scoring";
import { autoAssign } from "./assign";

function grabNumber(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const re = new RegExp(
      label + "[^\\d$]{0,20}\\$?\\s*([0-9][0-9,]*(?:\\.\\d+)?)\\s*(m|k|million)?",
      "i"
    );
    const m = text.match(re);
    if (m) {
      let n = Number(m[1].replace(/,/g, ""));
      const suf = (m[2] || "").toLowerCase();
      if (suf === "k") n *= 1_000;
      if (suf === "m" || suf === "million") n *= 1_000_000;
      if (n > 0) return n;
    }
  }
  return null;
}

export function analyzePacket(deal: Deal, combinedText: string): PacketReview {
  const text = combinedText || "";
  const hasText = text.trim().length > 40;
  const listingRev = deal.revenue;
  const listingEarn = deal.sde || deal.ebitda;
  const packetRev = grabNumber(text, ["revenue", "sales", "ttm"]);
  const packetSde = grabNumber(text, ["sde", "seller discretionary", "owner benefit"]);
  const packetEbitda = grabNumber(text, ["ebitda"]);
  const addbacks = grabNumber(text, ["add-backs", "add backs", "addbacks"]);

  const conflict =
    listingRev != null &&
    packetRev != null &&
    Math.abs(listingRev - packetRev) / Math.max(listingRev, packetRev) > 0.05;
  const numbersMatch = hasText && !conflict && (packetRev != null || packetSde != null);
  const declining = /declin|down year|lost customer|revenue fell|decreased/i.test(text);
  const addbacksAggressive = (addbacks != null && listingEarn != null && addbacks > listingEarn * 0.35) ||
    /personal vehicle|family payroll|one-time|add-back/i.test(text);
  const ownerDependent = /owner does all|owner handles sales|no manager|key man/i.test(text) || !hasText;
  const concentrated = /top customer|largest customer|%\s*of revenue|concentration/i.test(text);
  const growthPlausible = /backlog|second shift|quote pipeline|iso 9001|iATF/i.test(text);

  const scored = scorePacket({
    numbersMatch,
    conflict,
    declining,
    addbacksAggressive,
    ownerDependent,
    concentrated,
    growthPlausible,
  });

  const evidence: EvidencePoint[] = [
    {
      label: "Revenue",
      listingValue: listingRev != null ? money(listingRev) : "NOT PROVIDED",
      packetValue: packetRev != null ? money(packetRev) : hasText ? "NOT PROVIDED in extracted text" : "Packet text not extracted",
      kind: conflict ? "CONFLICT" : packetRev ? "SELLER_PROVIDED" : "NOT_PROVIDED",
      difference:
        conflict && listingRev && packetRev
          ? `CONFLICT — ${money(Math.abs(listingRev - packetRev))} difference`
          : undefined,
    },
    {
      label: "SDE / cash flow",
      listingValue: deal.sde != null ? money(deal.sde) : "NOT PROVIDED",
      packetValue: packetSde != null ? money(packetSde) : "NOT PROVIDED",
      kind: packetSde ? "SELLER_PROVIDED" : "NOT_PROVIDED",
    },
    {
      label: "EBITDA",
      listingValue: deal.ebitda != null ? money(deal.ebitda) : "NOT PROVIDED",
      packetValue: packetEbitda != null ? money(packetEbitda) : "NOT PROVIDED",
      kind: packetEbitda ? "SELLER_PROVIDED" : "NOT_PROVIDED",
    },
  ];

  const ans = (
    answer: string,
    light: TrafficLight,
    kind: PacketReview["answers"][string]["kind"]
  ) => ({ answer, light, kind });

  const answers: PacketReview["answers"] = {
    "Are the advertised financial numbers real?": conflict
      ? ans(
          evidence[0].difference || "Listing and packet do not match.",
          "critical",
          "CONFLICT"
        )
      : ans(
          hasText
            ? numbersMatch
              ? "Extracted packet numbers are in the same neighborhood as the listing. This is still SELLER PROVIDED, not verified against tax returns."
              : "Packet uploaded, but we could not reconcile listing vs packet. Treat as NOT PROVIDED / needs a human read."
            : "We only have listing numbers. Upload a CIM or P&L.",
          conflict ? "critical" : hasText ? "yellow" : "yellow",
          hasText ? "SELLER_PROVIDED" : "NOT_PROVIDED"
        ),
    "Has revenue grown or declined?": ans(
      declining
        ? "The packet language suggests decline. Confirm with a three-year revenue table."
        : "Trend is NOT PROVIDED as a verified series. Ask for three years of P&Ls.",
      declining ? "red" : "yellow",
      declining ? "SELLER_PROVIDED" : "NOT_PROVIDED"
    ),
    "Are margins improving or declining?": ans(
      "NOT PROVIDED until we have a simple annual P&L. Do not infer from one year of SDE.",
      "yellow",
      "NOT_PROVIDED"
    ),
    "Are seller add-backs reasonable?": ans(
      addbacksAggressive
        ? "Add-backs look aggressive or are a large share of earnings. CPA should recast before we believe SDE."
        : "Add-backs are not verified. Personal expenses, family payroll, and one-time items need a CPA.",
      addbacksAggressive ? "red" : "yellow",
      addbacksAggressive ? "SELLER_PROVIDED" : "NOT_PROVIDED"
    ),
    "How dependent is the business on the owner?": ans(
      ownerDependent
        ? "Assume high owner dependence until the org chart proves otherwise. That is common — and it is a risk."
        : "Packet hints at some management. Still verify who owns customers.",
      "yellow",
      "ASSUMPTION"
    ),
    "How concentrated are customers?": ans(
      concentrated
        ? "Packet mentions concentration. If top customer >50% this is HIGH RISK; 25–50% is MEDIUM/HIGH; under 20% is preferable."
        : "Customer concentration is NOT PROVIDED. This is a top-10 question.",
      concentrated ? "red" : "yellow",
      concentrated ? "SELLER_PROVIDED" : "NOT_PROVIDED"
    ),
    "Are customer relationships durable?": ans(
      "NOT PROVIDED. Tenure, contracts, tooling ownership, and who they call are still unknown. If a customer is large: CUSTOMER INTERVIEW REQUIRED BEFORE CLOSING.",
      "red",
      "NOT_PROVIDED"
    ),
    "Is equipment in good condition?": ans(
      "NOT PROVIDED. An equipment list is not a condition report.",
      "yellow",
      "NOT_PROVIDED"
    ),
    "What is actual capacity?": ans(
      "THIS IS A KEY DUE DILIGENCE QUESTION. Do not invent utilization.",
      "yellow",
      "NOT_PROVIDED"
    ),
    "What capex is likely required?": ans(
      "Unknown. Budget a maintenance capex number even if depreciation is high. Depreciation is not a free equipment replacement fund.",
      "yellow",
      "ASSUMPTION"
    ),
    "Is real estate attractive?": ans(
      deal.realEstateIncluded
        ? "Listing says real estate is included. Value, zoning, power, environmental, and expansion land are NOT PROVIDED."
        : "Real estate included? Unclear or no. Confirm lease vs own.",
      "yellow",
      deal.realEstateIncluded ? "SELLER_PROVIDED" : "NOT_PROVIDED"
    ),
    "What working capital is required?": ans(
      "NOT PROVIDED. We need AR, inventory, AP, and a target NWC peg.",
      "yellow",
      "NOT_PROVIDED"
    ),
    "Are there obvious legal/environmental issues?": ans(
      /epa|environmental|lawsuit|osha|contamination/i.test(text)
        ? "The packet mentions legal or environmental language. Attorney review required."
        : "Nothing obvious in extracted text. That is not a clean bill of health.",
      /epa|environmental|lawsuit/i.test(text) ? "red" : "yellow",
      "NOT_PROVIDED"
    ),
    "Is management sufficient?": ans(
      "Assume thin until proven. We need names, tenure, and who can run a week without the seller.",
      "yellow",
      "ASSUMPTION"
    ),
    "Can the business realistically grow?": ans(
      growthPlausible
        ? "There are positive hints (backlog, quality systems, or pipeline). Still do not pay for 2x."
        : "Growth is a hypothesis. Protect the current cash flow first.",
      "yellow",
      growthPlausible ? "SELLER_PROVIDED" : "ASSUMPTION"
    ),
    "What would we change after acquisition?": ans(
      "Keep customers safe. Install simple reporting. Professionalize sales only after we understand capacity. Do not rebrand on day one.",
      "green",
      "AI_CALCULATION"
    ),
  };

  const topQuestions = [
    "Please provide a three-year P&L (and YTD) that ties to tax returns.",
    "Please recast SDE with each add-back listed and explained.",
    "What percent of revenue is the largest customer? Top 5?",
    "May we speak with the top customers before closing?",
    "Who owns customer relationships if the seller leaves?",
    "Please provide the equipment list with manufacturer, model, year, and condition.",
    "What hours / shifts do you run, and what is the bottleneck?",
    "Is real estate included? If leased, remaining term and assignment?",
    "Any environmental reports, OSHA issues, or open claims?",
    "What working capital (AR, inventory, AP) stays in the deal?",
    "Which employees are family, and what do they actually do?",
    "Are there change-of-control clauses in customer or lease contracts?",
  ];

  const full = [
    ...topQuestions,
    "Bank statements for 12–24 months.",
    "AR aging and AP aging.",
    "Payroll register and workers' comp mod.",
    "Fixed asset / depreciation schedule.",
    "Customer revenue by year.",
    "Quality certifications and recent audits.",
    "Insurance loss runs.",
    "Material supplier concentration.",
    "Any customer-owned tooling or consigned inventory.",
    "Open quotes and win/loss log.",
    "Capex history (3 years) and known deferred maintenance.",
    "Organization chart.",
    "All related-party transactions.",
  ];

  const reasonsToBuy = [
    "Needed industry category (if Stage 1 agreed).",
    "Size is in our lower-middle-market range.",
    "Possible professionalization of sales.",
    deal.realEstateIncluded ? "Real estate may provide downside support." : "Asset-light may mean a simpler close.",
    deal.sellerFinancing ? "Seller financing can improve structure." : "Clean cash-flow story if SDE is real.",
  ];
  const reasonsToPass = [
    "Financials still unverified.",
    "Owner dependence unknown.",
    "Customer concentration unknown.",
    "Capacity unknown.",
    conflict ? "Listing vs packet conflict." : "Price may still be too high for risk.",
  ];

  return {
    reviewedAt: new Date().toISOString(),
    score: scored.score,
    decision: scored.decision,
    decisionWhy: scored.why,
    answers,
    topQuestions,
    fullDiligenceQuestions: full,
    evidence,
    whatWeKnow: hasText
      ? "We have seller packet text to compare against the listing."
      : "Packet files are stored, but little text was extracted. A human should open the CIM.",
    whatWeDont: "Tax-return-verified earnings, concentration, capacity, and legal/environmental cleanliness.",
    whyItMatters: "Stage 2 decides whether this is worth serious diligence money and a possible LOI.",
    whatNext:
      scored.decision === "ADVANCE_LOI"
        ? "Advance to diligence / LOI. Assign the CPA and attorney."
        : scored.decision === "PASS"
          ? "Pass. Do not spend further diligence cost."
          : scored.decision === "RENEGOTIATE"
            ? "Renegotiate price or terms before a full diligence sprint."
            : "Send the short question list to the seller / broker.",
    reasonsToBuy,
    reasonsToPass,
  };
}

export function applyPacketAssignments(deal: Deal) {
  deal.assignedQuestions = autoAssign(
    deal,
    (deal.packet?.topQuestions || []).slice(0, 12)
  );
}
