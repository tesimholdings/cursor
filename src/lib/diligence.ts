import type { Deal, DiligencePack, FinancialLine, FinalDecision } from "./types";
import { money } from "./format";
import { clamp } from "./scoring";
import { computeDownside, computeFinancing, computeTax } from "./finance";

function line(
  name: string,
  listing?: number | null,
  packet?: number | null,
  extra?: Partial<FinancialLine>
): FinancialLine {
  let kind: FinancialLine["kind"] = "NOT_PROVIDED";
  let note: string | undefined;
  if (listing != null && packet != null && Math.abs(listing - packet) > Math.max(listing, packet) * 0.05) {
    kind = "CONFLICT";
    note = `CONFLICT — ${money(Math.abs(listing - packet))} difference`;
  } else if (packet != null) kind = "SELLER_PROVIDED";
  else if (listing != null) kind = "SELLER_PROVIDED";
  return { name, listing, packet, kind, note, ...extra };
}

export function runDiligence(deal: Deal): DiligencePack {
  const conflict = deal.packet?.evidence.some((e) => e.kind === "CONFLICT") || false;

  const financials: FinancialLine[] = [
    line("Revenue", deal.revenue),
    line("COGS", null),
    line("Gross profit", null),
    line("Gross margin", null),
    line("Payroll", null),
    line("Rent", null),
    line("Utilities", null),
    line("Insurance", null),
    line("Maintenance", null),
    line("Marketing", null),
    line("Interest", null),
    line("Depreciation", null),
    line("EBITDA", deal.ebitda),
    line("SDE", deal.sde),
    line("Net income", null),
    line("Cash", null),
    line("AR", null),
    line("Inventory", null),
    line("Fixed assets", deal.ffe),
    line("Real estate", null),
    line("AP", null),
    line("Debt", null),
    line("Taxes payable", null),
    line("Equity", null),
  ];

  const sellerSde = deal.sde ?? null;
  const buyerSde = sellerSde != null ? sellerSde * 0.85 : null;
  const normalizedEbitda = deal.ebitda ?? (sellerSde != null ? sellerSde * 0.75 : null);

  const questionableAddbacks = [
    "Personal vehicle / travel — verify it is not needed to run the company.",
    "Family payroll — if they work, do not add back; if they do not, replacement cost still exists.",
    "One-time expenses — only add back if truly non-recurring.",
    "Depreciation add-back does not mean machines are free. Include maintenance capex.",
  ];

  const customers = [
    {
      name: "Top customer (name NOT PROVIDED)",
      revenue: deal.revenue ? deal.revenue * 0.32 : 0,
      share: 0.32,
      tenure: "NOT PROVIDED",
      interviewQuestions: [
        "How long have you used this supplier?",
        "Who do you call when something goes wrong?",
        "Would a change of ownership affect your orders?",
        "Do you own tooling or equipment on site?",
        "What would make you dual-source?",
      ],
    },
    {
      name: "Customer 2 (NOT PROVIDED)",
      revenue: deal.revenue ? deal.revenue * 0.14 : 0,
      share: 0.14,
      tenure: "NOT PROVIDED",
    },
    {
      name: "Customer 3 (NOT PROVIDED)",
      revenue: deal.revenue ? deal.revenue * 0.09 : 0,
      share: 0.09,
      tenure: "NOT PROVIDED",
    },
  ];

  const topShare = customers[0]?.share ?? 0;
  const concentrationFlag =
    topShare > 0.5 ? "HIGH" : topShare >= 0.25 ? "MEDIUM_HIGH" : topShare > 0 ? "PREFERABLE" : "UNKNOWN";

  const scores = {
    financial: clamp((deal.packet?.score || 50) - (conflict ? 15 : 0)),
    customer: concentrationFlag === "HIGH" ? 6 : concentrationFlag === "MEDIUM_HIGH" ? 8 : 10,
    operations: 8,
    growth: deal.screening?.growthScore ? Math.round(deal.screening.growthScore * 0.15) : 8,
    assets: deal.realEstateIncluded ? 8 : 5,
    financing: 6,
    tax: deal.screening?.taxAttractiveness === "High" ? 8 : 5,
    legal: 3,
    total: 0,
  };
  scores.total = clamp(
    scores.financial * 0.2 +
      scores.customer +
      scores.operations +
      scores.growth +
      scores.assets +
      scores.financing +
      scores.tax +
      scores.legal
  );
  // The spec weights: 20+15+15+15+10+10+10+5 = 100, with category scores out of those maxes.
  // Recalculate on 100-point scale using category maxima:
  const weighted = clamp(
    (scores.financial / 100) * 20 +
      (scores.customer / 15) * 15 +
      (scores.operations / 15) * 15 +
      (scores.growth / 15) * 15 +
      (scores.assets / 10) * 10 +
      (scores.financing / 10) * 10 +
      (scores.tax / 10) * 10 +
      (scores.legal / 5) * 5
  );

  const fatalRisks = [...deal.fatalRisks];
  if (conflict) fatalRisks.push("Earnings cannot be reconciled between listing and packet.");
  if (concentrationFlag === "HIGH") {
    fatalRisks.push("If the top customer is truly >50% and will not take a call, this can be a deal killer.");
  }

  let finalDecision: FinalDecision = "CONTINUE";
  if (fatalRisks.length && weighted < 70) finalDecision = "PASS";
  else if (weighted >= 80 && !fatalRisks.length) finalDecision = "STRONG_BUY";
  else if (weighted >= 70) finalDecision = "BUY_CONDITIONS";
  else if (weighted >= 55) finalDecision = "RENEGOTIATE";
  else finalDecision = "PASS";

  if (fatalRisks.some((r) => /fraud|catastrophe|cannot be reconciled/i.test(r))) {
    finalDecision = "PASS";
  }

  return {
    analyzedAt: new Date().toISOString(),
    financials,
    sellerSde,
    buyerSde,
    normalizedEbitda,
    questionableAddbacks,
    customers,
    concentrationFlag,
    equipment: [
      {
        name: "Major equipment (schedule NOT PROVIDED)",
        kind: "NOT_PROVIDED",
        capability: "Unknown",
        limitations: "Unknown — cannot confirm these machines can serve the customers we want.",
      },
    ],
    maxRevenueOnCurrentEquipment:
      "NOT PROVIDED — do not invent a capacity ceiling. Ask for machine hours and bottleneck.",
    realEstateNotes: deal.realEstateIncluded
      ? "Included per listing. Acres, SF, power, zoning, comps, environmental: NOT PROVIDED."
      : "Not listed as included. Confirm lease assignment.",
    growthPlan: {
      keepSafe: [
        "Do not change names, invoices, or quality process in week one.",
        "Seller stays for introductions if possible.",
        "Meet every supervisor and the top accounts.",
      ],
      first100: [
        "Weekly cash, shipments, quotes, and quality dashboard.",
        "Confirm working capital and payroll calendar.",
        "List deferred maintenance.",
        "Hire no one until the bottleneck is clear — except a bookkeeper if needed.",
      ],
      year1: [
        "Protect base revenue.",
        "Add one professional salesperson if capacity exists.",
        "Fix quoting speed.",
        "Maintenance capex only.",
      ],
      years2to3: [
        "Fill a second shift if demand is real.",
        "Add one adjacent service from the Stage 1 list.",
        "Reduce top-customer share with 5–10 new accounts.",
      ],
      years4to5: [
        "Consider a tuck-in acquisition only if the first shop is boringly stable.",
        "Equipment only against sold demand.",
      ],
    },
    scores: {
      financial: Math.round((scores.financial / 100) * 20),
      customer: scores.customer,
      operations: scores.operations,
      growth: scores.growth,
      assets: scores.assets,
      financing: scores.financing,
      tax: scores.tax,
      legal: scores.legal,
      total: weighted,
    },
    finalDecision,
    fatalRisks,
    whatWeKnow: `Seller SDE ${sellerSde ? money(sellerSde) : "NOT PROVIDED"}. Buyer-adjusted SDE ${buyerSde ? money(buyerSde) : "NOT PROVIDED"} (ASSUMPTION: 15% haircut until QoE). Packet score ${deal.packet?.score ?? "—"}.`,
    whatWeDont:
      "GL-level earnings, tax-return tie-out, true customer file, machine utilization, environmental Phase I, and bank-ready DSCR.",
    whyItMatters: "This is the last filter before we commit legal and accounting spend at full speed — or walk.",
    whatNext:
      finalDecision === "PASS"
        ? "Pass. A high score cannot hide a fatal risk, and this one does not clear."
        : finalDecision === "RENEGOTIATE"
          ? "Renegotiate price or protections, then continue."
          : "Issue an LOI with conditions, or finish the remaining diligence list.",
  };
}

export function attachModels(deal: Deal) {
  const price = deal.askingPrice || 0;
  const cf = deal.diligence?.buyerSde || deal.sde || deal.ebitda || 0;
  const inputs = deal.financing?.inputs || {
    purchasePrice: price,
    buyerEquity: Math.round(price * 0.2),
    bankDebt: Math.round(price * 0.5),
    sbaDebt: 0,
    realEstateDebt: deal.realEstateIncluded ? Math.round(price * 0.15) : 0,
    sellerNote: deal.sellerFinancing ? Math.round(price * 0.15) : 0,
    equipmentFinancing: 0,
    earnout: 0,
    holdback: Math.round(price * 0.05),
    interestRate: 0.085,
    termYears: 10,
    sellerRate: 0.06,
    sellerYears: 5,
  };
  const result = computeFinancing(inputs, cf);
  deal.financing = { inputs, result };
  deal.tax = computeTax({
    structure: "asset",
    purchasePrice: price,
    ffe: deal.ffe,
    realEstate: deal.realEstateIncluded,
    cashFlow: cf,
    interest: result.annualDebtService * 0.7,
  });
  deal.downside = computeDownside(deal.diligence?.normalizedEbitda || cf, result.annualDebtService, inputs.buyerEquity);
}
