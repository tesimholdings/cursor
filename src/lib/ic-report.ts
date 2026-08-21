import type { Deal } from "./types";
import { icHeadlineScore } from "./board-scoring";
import { money, pct } from "./format";

export function investmentCommitteeHtml(deal: Deal) {
  const s = deal.screening;
  const o = deal.ownerQuestions;
  const p = deal.packet;
  const d = deal.diligence;
  const f = deal.financing?.result;
  const t = deal.tax;
  const rec = d?.finalDecision || "CONTINUE DILIGENCE";
  const sections: [string, string][] = [
    ["1. Executive Summary", `${deal.name} is a ${deal.industry} business in ${deal.location}. Asking ${money(deal.askingPrice)}. Owner score ${o?.score ?? "—"}. Step 1B Pre-NDA score ${s?.preNdaScore ?? "—"}. Packet score ${p?.score ?? "—"}. IC score ${d ? icHeadlineScore(d.scores) : "—"}/100. Recommendation: ${rec}. Why: ${d?.recommendationWhy.join(" ") || "Full IC evidence is not available."}`],
    ["2. What the Business Does", o?.questions.find((q) => q.id === 1)?.answer || s?.questions.find((q) => q.id === 1)?.answer || "NOT PROVIDED"],
    ["3. Industry Need", o?.questions.find((q) => q.id === 2)?.answer || s?.questions.find((q) => q.id === 2)?.answer || "NOT PROVIDED"],
    ["4. Market Size & Growth", o?.questions.find((q) => q.id === 3)?.answer || s?.questions.find((q) => q.id === 3)?.answer || "NOT PROVIDED"],
    ["5. Competition", o?.questions.find((q) => q.id === 4)?.answer || s?.questions.find((q) => q.id === 4)?.answer || "NOT PROVIDED"],
    ["6. ICP", s?.icp || "NOT PROVIDED"],
    ["7. Customer Growth Opportunity", s?.questions.find((q) => q.id === 7)?.answer || "NOT PROVIDED"],
    ["8. Financial Analysis", `Ask ${money(deal.askingPrice)}. Revenue ${money(deal.revenue)}. SDE ${money(deal.sde)}. EBITDA ${money(deal.ebitda)}.`],
    ["9. Quality of Earnings", `Seller SDE ${money(d?.sellerSde)}. Buyer-adjusted SDE ${money(d?.buyerSde)} (ASSUMPTION until QoE). ${d?.questionableAddbacks.join(" ") || ""}`],
    ["10. Customer Concentration", `${d?.concentrationFlag || "UNKNOWN"}. ${d?.customers.length ? d.customers.map((c) => `${c.name} ${pct(c.share)}`).join("; ") : d?.concentrationNote || "NOT PROVIDED"}`],
    ["11. Operations", s?.questions.find((q) => q.id === 11)?.answer || "NOT PROVIDED"],
    ["12. Capacity", d?.maxRevenueOnCurrentEquipment || "NOT PROVIDED"],
    ["13. Equipment", d?.equipment.map((e) => e.name).join(", ") || "NOT PROVIDED"],
    ["14. Facility / Real Estate", d?.realEstateNotes || "NOT PROVIDED"],
    ["15. Management", p?.answers["Is management sufficient?"]?.answer || "NOT PROVIDED"],
    ["16. Growth Opportunities", (d?.growthPlan.year1 || []).join(" ")],
    ["17. Additional Revenue Streams", s?.questions.find((q) => q.id === 10)?.answer || "NOT PROVIDED"],
    ["18. Financing", `${f ? `Debt service ${money(f.annualDebtService)}. DSCR ${f.dscr?.toFixed(2) ?? "UNANSWERED"}. Cash-on-cash ${f.cashOnCash != null ? pct(f.cashOnCash) : "UNANSWERED"}.` : "NOT PROVIDED"} Preferred structure: ${d?.preferredStructure.join(" ") || "UNANSWERED"}`],
    ["19. Tax Strategy", t ? `Year 1 deductions ${t.year1Deductions == null ? "UNANSWERED" : money(t.year1Deductions)}. Ability to offset TESIM income: ${t.canOffsetTesimIncome}. Deferral/timing: ${t.deferralBenefits.join(" ")} Permanent savings: ${t.permanentSavings.join(" ")} Property treatment: ${t.propertyTreatment.join(" ")} ${t.disclaimer}` : "NOT PROVIDED"],
    ["20. Valuation", s ? `${s.valuationLabel}` : "Unknown"],
    ["21. Downside Scenarios", (deal.downside || []).map((c) => `${c.name}: EBITDA ${money(c.ebitda)} DSCR ${c.dscr?.toFixed(2) ?? "—"}`).join(" | ") || "NOT RUN"],
    ["22. Major Risks", `${(d?.fatalRisks.length ? d.fatalRisks : ["No fatal risk proven yet — that is not the same as no risk."]).join(" ")} Walk triggers: ${d?.walkTriggers.join(" ") || "NOT PROVIDED"}`],
    ["23. Diligence Findings", `SELLER CLAIMS: ${d?.findings.sellerClaims.join(" ") || "NONE"} VERIFIED FACTS: ${d?.findings.verifiedFacts.join(" ") || "NONE"} INFERENCES: ${d?.findings.inferences.join(" ") || "NONE"}`],
    ["24. Missing Information", d?.whatWeDont || s?.whatWeDont || "NOT PROVIDED"],
    ["25. Seller Questions", `TOP 10 BEFORE LOI: ${d?.top10BeforeLoi.join(" ") || (p?.topQuestions || []).join(" ")} TOP 10 BEFORE CLOSE: ${d?.top10BeforeClose.join(" ") || "NOT PROVIDED"}`],
    ["26. Customer Questions", (d?.customerInterviewQuestions || []).join(" ")],
    ["27. Recommended Deal Protections", d?.sellerProtections.join(" ") || "Holdback, working-capital peg, customer-call condition, equipment representation, and environmental condition."],
    ["28. Maximum Purchase Price", d ? `${d.maxPrice.value == null ? "UNANSWERED" : money(d.maxPrice.value)}. ${d.maxPrice.basis}` : "UNANSWERED"],
    ["29. First 100-Day Plan", (d?.growthPlan.first100 || []).join(" ")],
    ["30. Final Buy / Pass Recommendation", `${String(rec)}. What would make it exceptional: ${d?.exceptionalConditions.join(" ") || "UNANSWERED"}`],
  ];

  const body = sections
    .map(
      ([h, t]) =>
        `<section><h2>${escapeHtml(h)}</h2><p>${escapeHtml(t || "NOT PROVIDED")}</p></section>`
    )
    .join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Investment Committee — ${escapeHtml(deal.name)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; line-height: 1.45; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .sub { color: #555; margin-bottom: 32px; }
  h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  p { white-space: pre-wrap; }
  .rec { background: #111; color: #fff; display: inline-block; padding: 8px 14px; letter-spacing: 0.04em; }
</style></head>
<body>
  <p class="rec">${escapeHtml(String(rec))}</p>
  <h1>Investment Committee Report</h1>
  <p class="sub">${escapeHtml(deal.name)} · ${escapeHtml(deal.industry)} · ${escapeHtml(deal.location)}</p>
  ${body}
  <p style="margin-top:48px;font-size:12px;color:#777">Generated by Acquisition Command Center. Tax and legal conclusions require counsel. Do not treat estimates as audited facts.</p>
</body></html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
