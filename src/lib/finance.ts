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
  const ffe = opts.ffe ?? opts.purchasePrice * 0.2;
  const realty = opts.realEstate ? opts.purchasePrice * 0.25 : 0;
  const goodwill =
    opts.structure === "asset"
      ? Math.max(opts.purchasePrice - ffe - realty, 0)
      : 0;
  const bonus = opts.structure === "asset" ? ffe * 0.8 : 0;
  const costSeg = opts.structure === "asset" ? realty * 0.2 : 0;
  const amort = opts.structure === "asset" ? goodwill / 15 : 0;
  const year1 = bonus + costSeg + amort + (opts.interest ?? 0);
  const year5 = year1 + amort * 4 + ffe * 0.15;
  const year10 = year5 + amort * 5;
  const beforeTax = opts.cashFlow ?? null;
  const afterTax =
    beforeTax != null ? beforeTax * (opts.structure === "asset" ? 0.72 : 0.78) : null;
  return {
    structure: opts.structure,
    year1Deductions: year1,
    year5Deductions: year5,
    year10Deductions: year10,
    beforeTaxReturn: beforeTax,
    afterTaxReturn: afterTax,
    notes: [
      "Asset deals usually create more near-term depreciation than stock deals.",
      "Bonus depreciation, 179, cost segregation, MACRS, and 197 amortization are estimated only.",
      "State tax is ignored in this sketch.",
    ],
    disclaimer:
      "Tax conclusions require CPA / tax counsel verification. This is not tax advice.",
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
      financing: 0,
      tax: 0,
      legal: 0,
      total: 0,
    },
    finalDecision: "CONTINUE",
    fatalRisks: [],
    whatWeKnow: "",
    whatWeDont: "",
    whyItMatters: "",
    whatNext: "",
  };
}
