import type { DiligencePack, DownsideCase, FinancingInputs, FinancingResult, TaxResult, TrafficLight } from "./types";

export function pmt(principal: number, annualRate: number, years: number) {
  if (principal <= 0) return 0;
  if (years <= 0) return principal;
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return (principal / n) * 12;
  const monthly = (principal * r) / (1 - Math.pow(1 + r, -n));
  return monthly * 12;
}

export function computeFinancing(
  inputs: FinancingInputs,
  cashFlow?: number | null
): FinancingResult {
  const bank = pmt(inputs.bankDebt + inputs.sbaDebt + inputs.realEstateDebt, inputs.interestRate, inputs.termYears);
  const seller = pmt(inputs.sellerNote, inputs.sellerRate, inputs.sellerYears);
  const equip = pmt(inputs.equipmentFinancing, inputs.interestRate + 0.01, Math.min(inputs.termYears, 7));
  const annualDebtService = bank + seller + equip;
  const equityRequired = inputs.buyerEquity;
  const cashAfterDebt = cashFlow != null ? cashFlow - annualDebtService : null;
  const dscr = cashFlow && annualDebtService ? cashFlow / annualDebtService : null;
  const cashOnCash =
    cashAfterDebt != null && equityRequired > 0 ? cashAfterDebt / equityRequired : null;
  const notes: string[] = [];
  if (dscr != null && dscr < 1.25) notes.push("DSCR under 1.25x is tight for most lenders.");
  if (dscr != null && dscr < 1) notes.push("Debt service exceeds cash flow in this case — structure does not work.");
  if (equityRequired / Math.max(inputs.purchasePrice, 1) < 0.1) {
    notes.push("Equity under 10% of price is unusual outside SBA with a strong seller note.");
  }
  notes.push("These are simple mortgage-style estimates, not a bank commitment.");
  return { annualDebtService, dscr, cashAfterDebt, cashOnCash, equityRequired, notes };
}

export function computeTax(opts: {
  structure: "asset" | "stock";
  purchasePrice: number;
  ffe?: number | null;
  realEstate?: boolean | null;
  cashFlow?: number | null;
  interest?: number;
}): TaxResult {
  const assetDeal = opts.structure === "asset";
  return {
    structure: opts.structure,
    // A seller FF&E claim is not a tax allocation, so no deduction amount is
    // calculated until the allocation and eligibility facts are verified.
    year1Deductions: null,
    year5Deductions: null,
    year10Deductions: null,
    beforeTaxReturn: opts.cashFlow ?? null,
    afterTaxReturn: null,
    permanentSavings: [
      "NONE CONFIRMED. A purchase-price allocation and taxpayer-specific analysis are required.",
      "Deductions do not create value equal to their face amount and generally do not cure weak operating economics.",
    ],
    deferralBenefits: assetDeal
      ? [
          "Eligible used equipment acquired in an asset deal may qualify for Section 168(k), subject to acquisition, related-party, placed-in-service, business-use, and current-law requirements.",
          "Cost segregation may accelerate eligible building components; it changes timing and can create recapture.",
          "Section 197 goodwill amortization may create 15-year deductions if allocated goodwill is actually acquired.",
        ]
      : [
          "A stock purchase generally does not step up inside asset basis without a valid tax election.",
        ],
    eligibilityChecks: {
      acquisitionEntityIdentity: "UNVERIFIED",
      section469PassiveActivity: "UNVERIFIED",
      taxBasis: "UNVERIFIED",
      atRiskLimitations: "UNVERIFIED",
    },
    canOffsetTesimIncome: "UNVERIFIED",
    propertyTreatment: [
      opts.ffe
        ? `Seller states ${opts.ffe.toLocaleString(
            "en-US",
            { style: "currency", currency: "USD", maximumFractionDigits: 0 }
          )} of FF&E; tax basis, allocation, class life, and 168(k) eligibility are unverified.`
        : "Equipment tax basis and purchase-price allocation are not provided.",
      opts.realEstate
        ? "A used factory building is not Section 168(n) qualified production property merely because manufacturing occurs there. Land is nondepreciable; the building and eligible components require separate analysis."
        : "No acquired factory building is identified for this sketch.",
      "New construction or qualified production property rules must not be applied to an acquired used building without tax-counsel verification.",
    ],
    notes: [
      "Deferral is not permanent savings: accelerated depreciation generally reduces later deductions and may be recaptured.",
      "No assumption is made that acquisition deductions can offset approximately $20M of TESIM income.",
      "Entity identity, Section 469, basis, at-risk, business-use, recapture, interest limits, and state conformity remain unverified.",
      `Illustrative purchase price ${opts.purchasePrice.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })}; no tax allocation is inferred.`,
    ],
    disclaimer:
      "Tax conclusions require TESIM's CPA and tax counsel. Tax never rescues a bad company.",
  };
}

export function computeDownside(
  baseEbitda: number,
  debtService: number,
  equity: number
): DownsideCase[] {
  const row = (
    name: string,
    factor: number,
    extra = 0
  ): DownsideCase => {
    const ebitda = baseEbitda * factor - extra;
    const cashFlow = ebitda * 0.75;
    const dscr = debtService ? cashFlow / debtService : null;
    const equityReturn = equity ? cashFlow / equity : null;
    let light: TrafficLight = "green";
    if (dscr != null && dscr < 1.25) light = "yellow";
    if (dscr != null && dscr < 1) light = "red";
    if (ebitda < 0) light = "critical";
    return { name, ebitda, cashFlow, dscr, equityReturn, light };
  };

  return [
    row("Base case", 1),
    row("10% revenue decline (approx. 15% EBITDA hit)", 0.85),
    row("20% revenue decline", 0.7),
    row("Largest customer reduced ~half", 0.82),
    row("Largest customer lost", 0.65),
    row("Margin compression", 0.8),
    row("Higher payroll", 0.88),
    row("Equipment failure (extra $150k)", 0.95, 150_000),
    row("Higher interest (cash tighter)", 0.92),
  ];
}

export function emptyDiligence(): DiligencePack {
  return {
    analyzedAt: new Date().toISOString(),
    financials: [],
    questionableAddbacks: [],
    customers: [],
    concentrationFlag: "UNKNOWN",
    concentrationNote: "NOT PROVIDED",
    customerInterviewQuestions: [],
    equipment: [],
    realEstateNotes: "NOT PROVIDED",
    growthPlan: {
      keepSafe: [],
      first100: [],
      year1: [],
      years2to3: [],
      years4to5: [],
    },
    scores: {
      financial: 0,
      customer: 0,
      operations: 0,
      growth: 0,
      assets: 0,
      dealStructure: 0,
      tax: 0,
      legal: 0,
      total: 0,
    },
    finalDecision: "CONTINUE DILIGENCE",
    fatalRisks: [],
    findings: {
      sellerClaims: [],
      verifiedFacts: [],
      inferences: [],
      unanswered: [],
    },
    recommendationWhy: [],
    maxPrice: {
      value: null,
      basis: "UNANSWERED",
      kind: "NOT_PROVIDED",
    },
    preferredStructure: [],
    sellerProtections: [],
    top10BeforeLoi: [],
    top10BeforeClose: [],
    walkTriggers: [],
    exceptionalConditions: [],
    whatWeKnow: "",
    whatWeDont: "",
    whyItMatters: "",
    whatNext: "",
  };
}
