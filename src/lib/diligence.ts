import type {
  Deal,
  DiligencePack,
  EvidenceKind,
  FinancialLine,
  FinalDecision,
} from "./types";
import { icHeadlineScore } from "./board-scoring";
import { money, multiple, parseMoney, pct } from "./format";
import {
  analyzeCustomerConcentration,
  hasReadableDocument,
} from "./document-analysis";
import { computeDownside, computeFinancing, computeTax } from "./finance";

const TOP_10_BEFORE_LOI = [
  "Three years of monthly P&Ls plus YTD, tied to filed tax returns.",
  "Seller recast with every add-back and supporting invoice/payroll record.",
  "Revenue by customer for three years, including lost and new customers.",
  "Top-customer contracts, change-of-control terms, and permission for customer calls.",
  "Working-capital schedule: AR, inventory, AP, deferred revenue, and proposed peg.",
  "Equipment schedule with model, year, condition, liens, maintenance, and downtime.",
  "Actual hours, utilization, throughput, scrap/rework, and the measured bottleneck.",
  "Owner duties, management org chart, compensation, and transition commitment.",
  "Real-estate/lease terms, Phase I status, permits, zoning, and utility capacity.",
  "Debt structure, lender indication, seller note, holdback, earnout, and DSCR case.",
];

const TOP_10_BEFORE_CLOSE = [
  "QoE and tax-return reconciliation completed with no unresolved earnings conflict.",
  "Bank statements and general ledger reconcile to reported revenue and cash flow.",
  "Major customer calls completed; no expected loss or material volume reduction.",
  "All material contracts reviewed for assignment and change of control.",
  "Final working-capital peg and true-up mechanics agreed.",
  "Equipment inspection/appraisal and title/UCC searches completed.",
  "Environmental, zoning, permit, OSHA, insurance, and litigation review cleared.",
  "Key employees committed with compensation and retention plans.",
  "Financing commitment, sources/uses, downside DSCR, and liquidity reserve finalized.",
  "Purchase agreement protections, escrow/holdback, indemnities, and transition plan signed.",
];

const WALK_TRIGGERS = [
  "Fraud, altered records, or earnings that cannot be reconciled.",
  "A >50% customer intends to leave or seller blocks a required customer call.",
  "Material customer concentration without contracts or economically adequate protection.",
  "Downside cash flow cannot support debt service and required maintenance capex.",
  "Undisclosed environmental, legal, permit, or tax exposure with uncapped downside.",
  "Unexpected equipment replacement or facility work destroys the return case.",
  "Seller refuses a normal working-capital delivery or support for material add-backs.",
  "Critical license, lease, contract, or permit cannot transfer.",
];

export function runDiligence(deal: Deal): DiligencePack {
  const concentration = analyzeCustomerConcentration(deal);
  const hasFinancials = hasReadableDocument(
    deal.documents,
    (document) => document.category === "financials"
  );
  const hasTaxReturns = hasReadableDocument(
    deal.documents,
    (document) => document.category === "tax"
  );
  const hasEquipmentSchedule = hasReadableDocument(
    deal.documents,
    (document) => document.category === "equipment"
  );
  const hasLegal = hasReadableDocument(
    deal.documents,
    (document) => document.category === "legal"
  );
  const hasEnvironmental = deal.documents.some(
    (document) =>
      document.extraction?.status === "complete" &&
      /phase.?i|environment|epa|contamination/i.test(
        `${document.name} ${document.extraction.chunks
          .map((chunk) => chunk.text)
          .join(" ")}`
      )
  );
  const hasGl = deal.documents.some(
    (document) =>
      document.extraction?.status === "complete" &&
      /general ledger|\bgl\b/i.test(document.name)
  );
  const hasBankStatements = deal.documents.some(
    (document) =>
      document.extraction?.status === "complete" &&
      /bank statement/i.test(document.name)
  );
  const packetConflict =
    deal.packet?.evidence.some((evidence) => evidence.kind === "CONFLICT") ||
    false;
  const sellerEarnings = deal.sde ?? deal.ebitda ?? null;
  const askMultiple = multiple(deal.askingPrice, sellerEarnings);

  const financials: FinancialLine[] = [
    sellerLine("Revenue", deal.revenue),
    sellerLine("COGS", null),
    sellerLine("Gross profit", null),
    sellerLine("Gross margin", null),
    sellerLine("Payroll", null),
    sellerLine("Rent", null),
    sellerLine("Utilities", null),
    sellerLine("Insurance", null),
    sellerLine("Maintenance", null),
    sellerLine("Marketing", null),
    sellerLine("Interest", null),
    sellerLine("Depreciation", null),
    sellerLine("EBITDA", deal.ebitda),
    sellerLine("SDE", deal.sde),
    sellerLine("Net income", null),
    sellerLine("Cash", null),
    sellerLine("AR", null),
    sellerLine("Inventory", null),
    sellerLine("Fixed assets", deal.ffe),
    sellerLine("Real estate", null),
    sellerLine("AP", null),
    sellerLine("Debt", null),
    sellerLine("Taxes payable", null),
    sellerLine("Equity", null),
  ];

  // No haircut is a substitute for QoE. A normalized figure is accepted only
  // from an extracted QoE table when tax returns, GL, and bank statements are
  // also present.
  const buyerSde = null;
  const normalizedEbitda = findVerifiedNormalizedEbitda(
    deal,
    hasTaxReturns,
    hasGl,
    hasBankStatements
  );

  const scores = {
    financial: clamp(
      (sellerEarnings && deal.revenue ? 4 : 1) +
        (hasFinancials ? 4 : 0) +
        (hasTaxReturns ? 5 : 0) +
        (hasGl ? 3 : 0) +
        (hasBankStatements ? 2 : 0) +
        (packetConflict ? -4 : hasFinancials && hasTaxReturns ? 2 : 0),
      0,
      20
    ),
    customer: scoreCustomer(concentration.top1, concentration.hasCustomerContracts),
    operations: clamp(
      3 +
        (hasEquipmentSchedule ? 5 : 0) +
        (deal.employees ? 2 : 0) +
        (/capacity|utilization|downtime|throughput/i.test(extractedText(deal)) ? 3 : 0),
      0,
      15
    ),
    growth: clamp(
      4 +
        (deal.publicResearch?.status === "complete" ? 3 : 0) +
        (deal.ownerQuestions?.prospects.length ? 2 : 0) +
        (/backlog|pipeline|second shift|new customer/i.test(extractedText(deal)) ? 2 : 0),
      0,
      15
    ),
    assets: clamp(
      (deal.ffe ? 2 : 0) +
        (hasEquipmentSchedule ? 3 : 0) +
        (deal.realEstateIncluded ? 2 : 0) +
        (deal.documents.some((document) => /appraisal/i.test(document.name)) ? 3 : 0),
      0,
      10
    ),
    dealStructure: clamp(
      (deal.sellerFinancing ? 2 : 0) +
        (askMultiple != null && askMultiple <= 4 ? 2 : 0) +
        (deal.askingPrice ? 1 : 0),
      0,
      10
    ),
    // Tax is deliberately capped while identity/469/basis/at-risk are unknown.
    tax: deal.realEstateIncluded || deal.ffe ? 2 : 1,
    legal: clamp((hasLegal ? 2 : 0) + (hasEnvironmental ? 2 : 0), 0, 5),
    total: 0,
  };
  scores.total = icHeadlineScore(scores);

  const fatalRisks = [...deal.fatalRisks];
  if (packetConflict) {
    fatalRisks.push("Earnings/revenue claims cannot currently be reconciled.");
  }
  if (
    concentration.top1 != null &&
    concentration.top1 > 0.5 &&
    !concentration.hasCustomerContracts
  ) {
    fatalRisks.push(
      `Top customer is ${pct(
        concentration.top1
      )} with no extracted customer contract evidence.`
    );
  }

  const finalDecision = decide({
    score: scores.total,
    financialScore: scores.financial,
    fatalRisks,
    top1: concentration.top1,
    askMultiple,
    ownerPass: deal.ownerQuestions?.decision === "PASS",
    normalizedEarningsVerified: normalizedEbitda != null,
  });
  const recommendationWhy = recommendationReasons(
    deal,
    scores,
    concentration.top1,
    fatalRisks,
    askMultiple
  );
  const maxPrice = {
    value: null,
    basis:
      "UNANSWERED — maximum price requires verified normalized EBITDA/SDE, maintenance capex, working capital, debt terms, and customer durability. Seller-recast earnings are not a pricing basis.",
    kind: "NOT_PROVIDED" as EvidenceKind,
  };
  const preferredStructure = [
    "Asset purchase unless tax/legal counsel identifies a compelling exception.",
    "Deliver normalized working capital at close with a post-close true-up.",
    concentration.top1 != null && concentration.top1 >= 0.25
      ? "Use a material seller note/earnout tied to retention of concentrated revenue."
      : "Use seller financing where available to improve alignment.",
    "Hold back funds for unresolved tax, legal, environmental, and customer claims.",
    "Fund equipment only after demand, condition, title, and maintenance needs are verified.",
  ];
  const sellerProtections = [
    "Escrow/holdback and survival periods for financial, tax, legal, and environmental representations.",
    "Customer-retention earnout or price adjustment for material concentrated accounts.",
    "Seller note with offset rights for indemnity claims.",
    "Working-capital peg and dollar-for-dollar true-up.",
    "Transition services, introductions, noncompete, nonsolicit, and key-employee retention.",
    "Equipment condition/title representation and specific remedy for undisclosed replacement needs.",
  ];

  const findings = {
    sellerClaims: [
      deal.revenue ? `Revenue: ${money(deal.revenue)}.` : "Revenue not provided.",
      deal.sde ? `Seller-recast SDE: ${money(deal.sde)} — unverified.` : "",
      deal.ebitda ? `Seller-recast EBITDA: ${money(deal.ebitda)} — unverified.` : "",
      deal.ffe ? `Seller-stated FF&E: ${money(deal.ffe)} — not appraised.` : "",
    ].filter(Boolean),
    verifiedFacts: [
      hasFinancials ? "A financial workbook/PDF was successfully extracted." : "",
      hasTaxReturns ? "A tax document was successfully extracted." : "",
      concentration.customers.length
        ? `Customer revenue table extracted with ${concentration.customers.length} customers.`
        : "",
      hasEquipmentSchedule ? "An equipment document was successfully extracted." : "",
      normalizedEbitda != null
        ? `Normalized EBITDA ${money(
            normalizedEbitda
          )} extracted from QoE with tax/GL/bank support present.`
        : "",
    ].filter(Boolean),
    inferences: [
      deal.screening?.decisionWhy || "",
      askMultiple != null
        ? `Ask equals ${askMultiple.toFixed(
            2
          )}x seller-recast earnings; this is arithmetic, not verified value.`
        : "",
      concentration.note,
    ].filter(Boolean),
    unanswered: [
      !hasTaxReturns ? "Tax-return tie-out." : "",
      !hasGl ? "General-ledger reconciliation." : "",
      !hasBankStatements ? "Bank-statement proof of cash receipts." : "",
      concentration.top1 == null ? "Top 1/3/5 customer concentration." : "",
      normalizedEbitda == null ? "Verified normalized EBITDA and maintenance capex." : "",
      !hasEquipmentSchedule ? "Equipment condition, utilization, and replacement needs." : "",
      !hasEnvironmental ? "Environmental status." : "",
    ].filter(Boolean),
  };

  return {
    analyzedAt: new Date().toISOString(),
    financials,
    sellerSde: deal.sde ?? null,
    buyerSde,
    normalizedEbitda,
    questionableAddbacks: [
      "Every seller add-back remains a seller claim until supported.",
      "Family payroll requires replacement-cost analysis.",
      "Personal vehicle/travel must be separated from required operating expense.",
      "Depreciation is noncash but does not eliminate maintenance capex.",
      "One-time items must be proven nonrecurring.",
    ],
    customers: concentration.customers,
    concentrationFlag:
      concentration.top1 == null
        ? "UNKNOWN"
        : concentration.top1 > 0.5
          ? "HIGH"
          : concentration.top1 >= 0.25
            ? "MEDIUM_HIGH"
            : "PREFERABLE",
    concentrationNote: concentration.note,
    customerInterviewQuestions: [
      "How long have you used this supplier?",
      "Will an ownership change affect expected purchases?",
      "Do you expect volume to grow, hold, or shrink?",
      "Have you considered another supplier?",
      "What additional business could we earn?",
      "What could cause us to lose your business?",
    ],
    equipment: hasEquipmentSchedule
      ? [
          {
            name: "Extracted equipment schedule — models require human review",
            kind: "SELLER_PROVIDED",
            capability:
              "See source document. No utilization or value inferred from presence.",
          },
        ]
      : [
          {
            name: "Equipment schedule NOT PROVIDED / not readable",
            kind: "NOT_PROVIDED",
            capability: "Unknown",
            limitations:
              "Cannot confirm equipment can serve target customers.",
          },
        ],
    maxRevenueOnCurrentEquipment:
      "KEY DUE DILIGENCE QUESTION — no maximum revenue is calculated without verified utilization, bottleneck, yield, downtime, staffing, and demand.",
    realEstateNotes: deal.realEstateIncluded
      ? "SELLER CLAIM: real estate is included. Value, condition, power, zoning, environmental status, and expansion capacity remain unverified."
      : "Real estate is not listed as included. Lease/occupancy terms remain unanswered.",
    growthPlan: {
      keepSafe: [
        "Do not disrupt customer, quality, billing, or delivery routines.",
        "Complete seller-led introductions to key customers and employees.",
        "Protect liquidity and required maintenance.",
      ],
      first100: [
        "Install weekly cash, shipment, quality, customer, and quote reporting.",
        "Validate the bottleneck before hiring or buying equipment.",
        "Close urgent maintenance and safety gaps.",
      ],
      year1: [
        "Protect base revenue and reduce owner dependency.",
        "Professionalize sales only against verified available capacity.",
        "Build a maintenance-capex and working-capital plan.",
      ],
      years2to3: [
        "Add capacity only against won or highly probable demand.",
        "Reduce customer concentration through qualified adjacent accounts.",
      ],
      years4to5: [
        "Consider tuck-ins only after the base company runs without seller dependence.",
      ],
    },
    scores,
    finalDecision,
    fatalRisks,
    findings,
    recommendationWhy,
    maxPrice,
    preferredStructure,
    sellerProtections,
    top10BeforeLoi: TOP_10_BEFORE_LOI,
    top10BeforeClose: TOP_10_BEFORE_CLOSE,
    walkTriggers: WALK_TRIGGERS,
    exceptionalConditions: [
      "Verified normalized earnings exceed the current seller claim without aggressive add-backs.",
      "Top customer is under 20%, retention is proven, and direct calls confirm growth.",
      "Existing equipment has verified open capacity with low deferred maintenance.",
      "A repeatable sales engine can win qualified customers without speculative capex.",
      "Purchase price and seller financing produce resilient downside DSCR after maintenance capex.",
    ],
    whatWeKnow: findings.verifiedFacts.join(" ") || "No independently verified economic facts yet.",
    whatWeDont: findings.unanswered.join(" "),
    whyItMatters:
      "TESIM/AIS economics come first. Tax and growth optionality cannot rescue unverified earnings or fatal customer risk.",
    whatNext:
      finalDecision === "PASS"
        ? "PASS unless the fatal risk is disproven with primary evidence."
        : finalDecision === "RENEGOTIATE"
          ? "Reset price/structure before spending more diligence dollars."
          : "Complete the top pre-LOI diligence items and update the score from evidence.",
  };
}

export function attachModels(deal: Deal) {
  const price = deal.askingPrice || 0;
  const verifiedCashFlow = deal.diligence?.normalizedEbitda ?? null;
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
  const result = computeFinancing(inputs, verifiedCashFlow);
  deal.financing = { inputs, result };
  deal.tax = computeTax({
    structure: "asset",
    purchasePrice: price,
    ffe: deal.ffe,
    realEstate: deal.realEstateIncluded,
    cashFlow: verifiedCashFlow,
    interest: result.annualDebtService * 0.7,
  });
  deal.downside =
    verifiedCashFlow == null
      ? []
      : computeDownside(
          verifiedCashFlow,
          result.annualDebtService,
          inputs.buyerEquity
        );
}

function sellerLine(
  name: string,
  value?: number | null
): FinancialLine {
  return {
    name,
    listing: value,
    kind: value == null ? "NOT_PROVIDED" : "SELLER_PROVIDED",
    note:
      value == null
        ? "UNANSWERED"
        : "Seller/listing claim; not verified by QoE.",
  };
}

function scoreCustomer(
  top1: number | null,
  hasContracts: boolean
): number {
  if (top1 == null) return 3;
  if (top1 > 0.5) return hasContracts ? 4 : 0;
  if (top1 >= 0.25) return hasContracts ? 8 : 5;
  if (top1 >= 0.2) return 10;
  return hasContracts ? 15 : 13;
}

function decide(input: {
  score: number;
  financialScore: number;
  fatalRisks: string[];
  top1: number | null;
  askMultiple: number | null;
  ownerPass: boolean;
  normalizedEarningsVerified: boolean;
}): FinalDecision {
  if (input.fatalRisks.length) return "PASS";
  if (input.ownerPass) return "PASS";
  if (
    input.top1 != null &&
    input.top1 >= 0.25 &&
    input.askMultiple != null &&
    input.askMultiple >= 4
  ) {
    return "RENEGOTIATE";
  }
  if (!input.normalizedEarningsVerified) {
    return input.askMultiple != null && input.askMultiple > 4.5
      ? "RENEGOTIATE"
      : "CONTINUE DILIGENCE";
  }
  if (input.financialScore < 8) {
    return input.askMultiple != null && input.askMultiple > 5
      ? "RENEGOTIATE"
      : "CONTINUE DILIGENCE";
  }
  if (input.score >= 85) return "STRONG BUY";
  if (input.score >= 72) return "BUY SUBJECT TO CONDITIONS";
  if (input.score >= 55) return "CONTINUE DILIGENCE";
  return "RENEGOTIATE";
}

function recommendationReasons(
  deal: Deal,
  scores: DiligencePack["scores"],
  top1: number | null,
  fatalRisks: string[],
  askMultiple: number | null
) {
  return [
    fatalRisks.length
      ? `Fatal-risk override: ${fatalRisks.join(" ")}`
      : "No fatal risk has been proven from currently extracted evidence.",
    `Financial evidence score is ${scores.financial}/20 (purchase-value weight 25); seller-recast earnings are not verified.`,
    top1 == null
      ? "Customer concentration is unanswered."
      : `Top customer is ${pct(top1)} based on an extracted customer table.`,
    askMultiple == null
      ? "Asking-price multiple cannot be calculated."
      : `Ask is ${askMultiple.toFixed(2)}x seller-recast earnings; not a verified normalized multiple.`,
    deal.tax
      ? "Tax benefits remain subordinate to economics."
      : "Tax benefits have not been relied upon.",
  ];
}

function extractedText(deal: Deal) {
  return deal.documents
    .flatMap((document) => document.extraction?.chunks || [])
    .map((chunk) => chunk.text)
    .join(" ");
}

function findVerifiedNormalizedEbitda(
  deal: Deal,
  hasTaxReturns: boolean,
  hasGl: boolean,
  hasBankStatements: boolean
): number | null {
  if (!hasTaxReturns || !hasGl || !hasBankStatements) return null;
  for (const document of deal.documents) {
    if (
      document.extraction?.status !== "complete" ||
      !/quality.?of.?earnings|\bqoe\b/i.test(document.name)
    ) {
      continue;
    }
    for (const table of document.extraction.tables || []) {
      const metricHeader = table.headers.find((header) =>
        /metric|line|account|description/i.test(header)
      );
      const valueHeader = table.headers.find((header) =>
        /normalized|amount|value|ebitda/i.test(header)
      );
      if (!metricHeader || !valueHeader) continue;
      const row = table.rows.find((candidate) =>
        /normalized ebitda/i.test(String(candidate.values[metricHeader] || ""))
      );
      const value = row ? parseMoney(row.values[valueHeader]) : null;
      if (value != null && value > 0) return value;
    }
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
