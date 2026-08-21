import { matchIndustry } from "./industry";
import { money, multiple, pct } from "./format";
import { isSafeCitationUrl } from "./public-research";
import {
  defaultWhy,
  firstSentences,
  isTemplateWhy,
  tightenAnswer,
  unanswered as unansweredItem,
} from "./copy";
import {
  cimProse,
  hasReadableCim,
  packetText,
  printedConcentration,
} from "./deal-picture";
import type {
  Deal,
  EvidenceKind,
  OwnerQuestion,
  OwnerQuestionReport,
  OwnerQuestionSection,
  Prospect,
  ResearchSource,
  TrafficLight,
} from "./types";

const SECTION_META: Array<{
  id: OwnerQuestionSection;
  title: string;
  from: number;
  to: number;
}> = [
  { id: "business", title: "Understand the Business", from: 1, to: 5 },
  { id: "customers", title: "Understand the Customers", from: 6, to: 9 },
  { id: "growth", title: "Understand Growth", from: 10, to: 15 },
  { id: "capacity_assets", title: "Understand Capacity & Assets", from: 16, to: 25 },
  { id: "people_risk", title: "Understand People & Risk", from: 26, to: 32 },
  { id: "industry_valuation", title: "Understand the Industry & Valuation", from: 33, to: 39 },
  { id: "decision", title: "Should We Request the NDA?", from: 40, to: 40 },
];

const TITLES = [
  "Explain the business like we are in high school",
  "Is this industry actually needed?",
  "How big is the industry?",
  "How many companies are in this industry?",
  "How does this company compare to others its size?",
  "Who is the ideal customer?",
  "How many potential customers exist?",
  "Who could actually become customers?",
  "Could we realistically win these customers?",
  "Does the company currently do sales?",
  "What would it take to grow sales?",
  "What other revenue streams could we add?",
  "What does customer onboarding look like?",
  "How scalable is the business?",
  "If we add 5, 10, or 20 new clients, what happens?",
  "What is the current output / capacity?",
  "What happens if we run more hours?",
  "What are the main capacity limitations?",
  "What machinery / equipment does the company have?",
  "What can the current machinery actually do?",
  "What new machinery should we buy?",
  "Can we finance the equipment?",
  "Are the sellers overvaluing the equipment / assets?",
  "What would it cost to replace the equipment new?",
  "Can the facility support growth?",
  "What team would be needed to double the business?",
  "How dependent is the company on the owner?",
  "Will new ownership disrupt customer relationships?",
  "Can we speak to the current clients?",
  "How concentrated are customers?",
  "What are the biggest risks?",
  "What are the biggest upsides?",
  "Could this company be a platform for acquisitions?",
  "What are the top 20 largest companies in the industry?",
  "What are 20 companies around our size?",
  "How fast is the industry expected to grow?",
  "Is the asking price attractive at first glance?",
  "Are the financials believable at first glance?",
  "What would the business look like after we grow it?",
  "Should we even spend more time on this company?",
];

function sectionFor(id: number): OwnerQuestionSection {
  return SECTION_META.find((s) => id >= s.from && id <= s.to)!.id;
}

function listingSources(deal: Deal): ResearchSource[] {
  const now = new Date().toISOString();
  const sources: ResearchSource[] = [
    {
      id: `listing_${deal.id}`,
      title: deal.source ? `Uploaded spreadsheet — ${deal.source}` : "Uploaded spreadsheet",
      kind: "LISTING",
      accessedAt: now,
    },
  ];
  if (deal.listingUrl && isSafeCitationUrl(deal.listingUrl)) {
    sources.push({
      id: `listing_url_${deal.id}`,
      title: "Business listing supplied by owner",
      url: deal.listingUrl,
      kind: "LISTING",
      accessedAt: now,
    });
  }
  return sources;
}

function make(
  deal: Deal,
  id: number,
  answer: string,
  options: {
    result?: string;
    light?: TrafficLight;
    kind?: EvidenceKind;
    known?: string[];
    unknown?: string[];
    why?: string;
    next?: string;
    details?: string;
    sources?: ResearchSource[];
  } = {}
): OwnerQuestion {
  const kind = options.kind || "ESTIMATE";
  return {
    id,
    section: sectionFor(id),
    title: TITLES[id - 1],
    answer,
    result: options.result,
    light: options.light || "yellow",
    kind,
    known: options.known || [],
    unknown: options.unknown || [],
    why: options.why || defaultWhy(),
    next: options.next || "NOT AVAILABLE YET — ASK SELLER",
    details: options.details,
    sources:
      options.sources ??
      (kind === "SELLER_PROVIDED" || kind === "AI_CALCULATION"
        ? listingSources(deal)
        : []),
  };
}

function scenarioDetails(revenue?: number | null) {
  const base = revenue || 0;
  const lines = ["DEMAND SCENARIO ONLY — CAPACITY NOT VERIFIED"];
  for (const count of [5, 10, 20]) {
    for (const average of [100_000, 250_000, 500_000, 750_000, 1_000_000]) {
      const added = count * average;
      lines.push(
        `${count} clients × ${money(average)} = +${money(added)}; new total ${
          revenue ? money(base + added) : "NOT AVAILABLE (current revenue missing)"
        }. Concentration should improve only if existing customers are retained.`
      );
    }
  }
  return lines.join("\n");
}

function strongestLight(lights: TrafficLight[]): TrafficLight {
  if (lights.includes("critical")) return "critical";
  if (lights.includes("red")) return "red";
  if (lights.includes("yellow")) return "yellow";
  return "green";
}

export function buildOwnerQuestions(deal: Deal): OwnerQuestionReport {
  const ind = matchIndustry(deal.industry, deal.name, deal.notes);
  const earnings = deal.sde || deal.ebitda;
  const revPerEmployee = deal.revenue && deal.employees ? deal.revenue / deal.employees : null;
  const earnMultiple = multiple(deal.askingPrice, earnings);
  const revenueMultiple = multiple(deal.askingPrice, deal.revenue);
  const margin = earnings && deal.revenue ? earnings / deal.revenue : null;
  const assetCoverage = deal.ffe && deal.askingPrice ? deal.ffe / deal.askingPrice : null;
  const needed =
    ind.discretionary === "essential"
      ? ind.wantToOwn10Years
        ? "HIGHLY NEEDED"
        : "NEEDED"
      : ind.discretionary === "mixed"
        ? "MODERATELY NEEDED"
        : ind.wantToOwn10Years
          ? "MODERATELY NEEDED"
          : "AT RISK";
  const valuation =
    earnMultiple == null
      ? "CANNOT DETERMINE YET"
      : earnMultiple < 3
        ? "VERY ATTRACTIVE"
        : earnMultiple <= 4
          ? "ATTRACTIVE"
          : earnMultiple <= 5
            ? "FAIR"
            : "EXPENSIVE";
  // Named prospects and comps must come from fetched, cited public research.
  // Static memory lists are intentionally not used.
  const prospects: Prospect[] = [];
  const companyLeaders: string[] = [];
  const q: OwnerQuestion[] = [];
  const concentration = printedConcentration(packetText(deal));

  q.push(
    make(
      deal,
      1,
      cimProse(deal, 3) ||
        firstSentences(
          deal.notes ||
            unansweredItem(
              "what they sell, who pays, and how work moves through the shop"
            ),
          3
        ),
      {
        light: hasReadableCim(deal) || deal.notes ? "green" : "yellow",
        kind: hasReadableCim(deal) || deal.notes ? "SELLER_PROVIDED" : "NOT_PROVIDED",
        known: [
          deal.industry,
          hasReadableCim(deal)
            ? "CIM is on the card"
            : deal.notes || "No listing description",
        ],
        unknown: [
          unansweredItem("exact product mix"),
          unansweredItem("daily workflow"),
          unansweredItem("major cost breakdown"),
        ],
        next: "Ask for a one-page order-to-cash walkthrough and revenue by product/service.",
      }
    ),
    make(
      deal,
      2,
      `${ind.needed} Technology / AI: ${ind.disruption} Imports can pressure commodity work; local responsiveness, qualification, service, and reshoring can protect differentiated work. Regulation: ${ind.regulatory} Recession: ${ind.economicSensitivity}`,
      {
        result: needed,
        light: needed === "AT RISK" ? "red" : needed === "MODERATELY NEEDED" ? "yellow" : "green",
        kind: "ESTIMATE",
        known: [ind.discretionary, ind.obsolescence],
        unknown: ["Target-specific end-market exposure"],
        next: "Confirm revenue by end market and whether customers can import or automate the work away.",
      }
    ),
    make(
      deal,
      3,
      `Current U.S. market: ${ind.usMarketSize.value}. Expected growth: ${ind.cagr.value}. A five- and ten-year dollar market forecast is NOT AVAILABLE YET without a named, current market source. Growth drivers include customer production, replacement demand, and reshoring where relevant. Threats include recession, imports, automation, regulation, and customer insourcing. The market appears broad enough to grow through share capture rather than needing an industry boom, but the figure must be verified.`,
      {
        light: ind.usMarketSize.value === "NOT PROVIDED" ? "yellow" : "green",
        kind: "ESTIMATE",
        unknown: ["Named current market report", "5-year market value", "10-year market value"],
        next: "Verify market size and CAGR from Census/IBISWorld/trade-association data before relying on it.",
      }
    ),
    make(
      deal,
      4,
      `Total U.S. companies: ${ind.competitorsNational} Relevant regional competitors: ${ind.competitorsRegional} Similar-size companies: ${ind.sameSizeCount} Larger companies: ${ind.largeCompetitors}`,
      {
        kind: "ESTIMATE",
        known: [ind.fragmentation],
        unknown: ["Verified establishment count", "Target's exact local competitors"],
        next: "Public private-company revenue is sparse. Build named local and same-size lists after confirming capabilities.",
        details: companyLeaders.length
          ? `Named large-company starting set (scale and revenue require verification):\n${companyLeaders.map((x, i) => `${i + 1}. ${x}`).join("\n")}`
          : "NOT AVAILABLE YET — ASK SELLER for its competitor list.",
      }
    ),
    make(
      deal,
      5,
      `${deal.name} has ${money(deal.revenue)} revenue, ${deal.employees ?? "NOT AVAILABLE"} employees, ${
        revPerEmployee ? `${money(revPerEmployee)} revenue per employee` : "unknown revenue per employee"
      }, and ${margin != null ? `${pct(margin)} listed earnings margin` : "unknown margin"}. Equipment, locations, certifications, customer profile, and historical growth are not complete. Based on listing data alone it appears ${
        revPerEmployee && revPerEmployee > 250_000 ? "potentially efficient" : "normal or impossible to benchmark"
      }, not proven unusually good.`,
      {
        result: revPerEmployee && margin && margin > 0.2 ? "POSSIBLY ABOVE AVERAGE — VERIFY" : "NORMAL / CANNOT FULLY BENCHMARK",
        light: "yellow",
        kind: "AI_CALCULATION",
        unknown: ["Peer margins", "Peer certifications", "Growth history"],
        next: "KEY DUE DILIGENCE QUESTION — benchmark only after normalized financials and equipment/certification schedules.",
      }
    )
  );

  q.push(
    make(deal, 6, `ICP — ${ind.icp} The customer problem is obtaining reliable supply/service at acceptable quality, lead time, and price. Typical purchase size is embedded in this estimate; exact account size is NOT AVAILABLE YET. Buyers may choose this company for responsiveness, process fit, geography, or second-source capacity. They switch when incumbents miss quality, lead time, price, or service.`, {
      light: ind.icp.startsWith("NOT PROVIDED") ? "yellow" : "green",
      unknown: ["Actual average order and account size", "Why current customers chose this company"],
      next: "Ask for customer categories, average order size, and win/loss reasons.",
    }),
    make(deal, 7, `Broad potential market: ${ind.customerUniverse} Realistic ICP: ${ind.icpUniverse} High-priority prospects: ${ind.highPriorityUniverse} These are deliberately bounded estimates, not an inflated TAM.`, {
      kind: "ESTIMATE",
      unknown: ["Capability-filtered named account count"],
      next: "Filter prospects by geography, certifications, machine/service capability, and minimum account economics.",
    }),
    make(deal, 8, prospects.length ? `An initial list of 30 real companies is attached as prospects only. None is a confirmed customer or confirmed fit. Their current revenue and active sourcing needs must be verified.` : "NOT AVAILABLE YET — the business category is not specific enough to name 30 prospects without fabricating fit.", {
      result: prospects.length ? "30 PROSPECTS IDENTIFIED — FIT UNVERIFIED" : "NOT AVAILABLE YET — ASK SELLER",
      light: prospects.length ? "yellow" : "red",
      kind: prospects.length ? "ESTIMATE" : "NOT_PROVIDED",
      unknown: ["Active RFQs", "Supplier qualification status", "Buyer contacts"],
      next: "Confirm the target's capability envelope before contacting any prospect.",
      details: prospects.map((p, i) => `${i + 1}. ${p.company} | ${p.industry} | ${p.revenue} | ${p.location} | ${p.fit} | Could buy: ${p.potentialOffering} | Fit: ${p.whyFit} | Barrier: ${p.barrier}`).join("\n"),
    }),
    make(deal, 9, `Realistic conclusion: these accounts are prospects, not a forecast. The company is most likely to enter as a second source or overflow supplier, then earn primary share through quality and delivery. Buyers switch for persistent service, quality, capacity, or price failures. Required certifications, quality systems, equipment fit, staffing, facility capacity, and exact sales cycle are NOT AVAILABLE YET. Typical cycle: ${ind.typicalSalesCycle}`, {
      result: "POSSIBLE — CAPABILITY AND QUALIFICATION NOT VERIFIED",
      light: "yellow",
      unknown: ["Certifications", "Quality requirements", "Capacity", "Qualification process"],
      next: "KEY DUE DILIGENCE QUESTION — map each high-fit prospect to equipment, people, quality, and sales-cycle requirements.",
    })
  );

  q.push(
    make(deal, 10, `${ind.salesNorm} Dedicated salespeople, owner involvement, outbound activity, marketing budget, CRM, website leads, advertising, trade shows, referrals, and share-of-wallet motion are NOT AVAILABLE YET. Lack of professional sales may be an opportunity, but only after capacity and retention are understood.`, {
      result: "POTENTIAL OPPORTUNITY — NOT PROVEN",
      kind: "NOT_PROVIDED",
      next: "Ask for the org chart, CRM screenshot, lead sources, quote log, marketing spend, and seller's weekly sales hours.",
    }),
    make(deal, 11, `+25%: improve quote speed, target lookalike accounts, protect service, and add one capable seller only if capacity exists. +50%: add qualification support, a shift/cell or service crews, working capital, and a manager who can absorb complexity. 2X: build a real sales function, diversify markets, add management, capacity, people, certifications, and working capital. Practical sequence: prove demand → identify bottleneck → fund capacity → hire against a loaded plan.`, {
      light: "yellow",
      kind: "AI_CALCULATION",
      known: ind.growthLevers,
      unknown: ["Current quote pipeline", "Win rate", "Capacity", "Working capital"],
      next: "Do not underwrite 2X until quote wins and operational capacity are demonstrated.",
    }),
    make(deal, 12, ind.extraRevenue.length ? `Adjacent opportunities ranked by implementation burden:\nEasy: ${ind.extraRevenue.slice(0, 2).join("; ") || "none identified"}.\nModerate: ${ind.extraRevenue.slice(2, 4).join("; ") || "none identified"}.\nHard: ${ind.extraRevenue.slice(4).join("; ") || "new locations or acquisitions only after the core is stable"}.` : "NOT AVAILABLE YET — the industry/capability mix is too vague for responsible adjacency recommendations.", {
      kind: ind.extraRevenue.length ? "ESTIMATE" : "NOT_PROVIDED",
      next: "Ask customers what they already buy from adjacent vendors before building anything.",
    }),
    make(deal, 13, `${ind.onboarding} Full path: Lead → Quote → Qualification → Contract/PO → Setup → Tooling/equipment/implementation → Trial/first delivery → Customer approval → Recurring work → billing/collection. Typical sales cycle: ${ind.typicalSalesCycle} Company effort, customer effort, setup cost, approval time, switching difficulty, and days-to-cash are NOT AVAILABLE YET.`, {
      light: "yellow",
      unknown: ["Setup cost", "Approval gates", "Cash conversion cycle"],
      next: "Ask seller for three recent wins from lead through first cash receipt.",
    }),
    make(deal, 14, `Commercial scalability: moderate until win rate is known. Operational scalability: unknown until the bottleneck is measured. Physical scalability: unknown without facility/equipment data. Management scalability: unknown without an org chart. Capital scalability: likely requires working capital and possibly equipment. Revenue can often grow 25% more easily than 2X; no capacity is assumed.`, {
      result: "MODERATELY SCALABLE — NOT YET VERIFIED",
      light: "yellow",
      kind: "ASSUMPTION",
      next: "KEY DUE DILIGENCE QUESTION — quantify the constraint in each scalability category.",
    }),
    make(deal, 15, "The attached scenarios show demand math only. They are not a forecast and do not assert that the business can produce the work.", {
      result: "DEMAND SCENARIO ONLY — CAPACITY NOT VERIFIED",
      light: "yellow",
      kind: "AI_CALCULATION",
      known: deal.revenue ? [`Current listed revenue ${money(deal.revenue)}`] : [],
      unknown: ["Available capacity", "Current concentration", "Gross margin on new work"],
      next: "Validate capacity and contribution margin before using any scenario.",
      details: scenarioDetails(deal.revenue),
    })
  );

  q.push(
    make(deal, 16, "Current hours, utilization, output, practical maximum, bottleneck, available capacity, revenue by machine/service crew, downtime, and maximum revenue before expansion are NOT AVAILABLE YET.", {
      result: "KEY DUE DILIGENCE QUESTION",
      kind: "NOT_PROVIDED",
      light: "yellow",
      next: "Request a machine/crew schedule with available hours, sold hours, output, downtime, and revenue at the bottleneck.",
    }),
    make(deal, 17, "Current schedule is NOT AVAILABLE YET, so additional-shift, 24/6, and 24/7 hours cannot be calculated responsibly. More operating hours only create additional revenue if demand exists. Added shifts also require labor, supervision, maintenance, utilities, quality coverage, and planned downtime.", {
      result: "KEY DUE DILIGENCE QUESTION",
      kind: "NOT_PROVIDED",
      next: "Obtain current staffed hours and maintenance windows; then model theoretical hours separately from sold hours.",
    }),
    make(deal, 18, "The top three bottlenecks cannot be ranked from listing data. Candidates are: #1 sold machine/crew hours or demand, #2 skilled labor/management, #3 facility/power/working capital. That ranking is an assumption, not a finding.", {
      result: "NOT AVAILABLE YET — ASK SELLER",
      kind: "ASSUMPTION",
      next: "Ask: what prevented the last 20% of growth, what work was declined, and where does WIP wait?",
    }),
    make(deal, 19, deal.ffe ? `Seller lists ${money(deal.ffe)} of FF&E. Equipment type, manufacturer, model, year, quantity, capability, used value, replacement cost, and parts/service availability are NOT AVAILABLE YET.` : "No usable equipment schedule or seller FF&E value is available.", {
      result: "NOT AVAILABLE YET — ASK SELLER",
      kind: deal.ffe ? "SELLER_PROVIDED" : "NOT_PROVIDED",
      known: deal.ffe ? [`Seller FF&E claim: ${money(deal.ffe)}`] : [],
      next: "Require a serial-number-level equipment schedule and photos.",
    }),
    make(deal, 20, "Part/product size, volume, accuracy, materials, speed, automation, and quality-system limits are NOT AVAILABLE YET. We cannot say whether current equipment can serve the target prospects.", {
      result: "UNKNOWN UNTIL EQUIPMENT SCHEDULE",
      kind: "NOT_PROVIDED",
      next: "Map prospect requirements to each machine's actual envelope and certification.",
    }),
    make(deal, 21, "No new machine should be recommended from listing data. Preferred strategy: customer demand first → equipment second. A commercially justified request must state the lost/target work, used/new/installed cost, capacity gain, staffing, contribution margin, and payback.", {
      result: "NO PURCHASE RECOMMENDATION YET",
      kind: "ASSUMPTION",
      light: "green",
      next: "Use lost-quote data and the measured bottleneck before obtaining equipment quotes.",
    }),
    make(deal, 22, "Common structures include bank equipment loans, leases, SBA proceeds, manufacturer or used-equipment financing, customer-funded or customer-owned equipment, and seller financing. Example only: 20% cash plus an 80% five-to-seven-year equipment loan, subject to appraisal and lender underwriting.", {
      result: "LIKELY FINANCEABLE — SPECIFIC COLLATERAL NOT VERIFIED",
      kind: "ESTIMATE",
      light: "green",
      next: "Confirm liens, machine age, appraisal value, and lender advance rate.",
    }),
    make(deal, 23, deal.ffe ? `Seller value: ${money(deal.ffe)}. Estimated FMV: NOT AVAILABLE. Estimated orderly liquidation: NOT AVAILABLE. NEW REPLACEMENT COST IS NOT THE SAME AS CURRENT VALUE.` : "Seller value, FMV, liquidation value, and replacement cost are NOT AVAILABLE.", {
      result: "CANNOT DETERMINE YET",
      kind: deal.ffe ? "SELLER_PROVIDED" : "NOT_PROVIDED",
      next: "Compare exact models against dealer/auction comps and obtain an appraisal if asset coverage matters.",
    }),
    make(deal, 24, "The cost to recreate the equipment fleet — machines, rigging, electrical, installation, and supporting equipment — is NOT AVAILABLE without the equipment schedule. Do not multiply seller FF&E by an arbitrary factor.", {
      result: "NOT AVAILABLE YET — ASK SELLER",
      kind: "NOT_PROVIDED",
      next: "Price exact replacement machines only after model/year/capability are known.",
    }),
    make(deal, 25, deal.realEstateIncluded ? "Real estate is listed as included, but square footage, land, expansion space, parking/loading, utilities, power, zoning, cooling, air, rigging, floor loading, and material storage are NOT AVAILABLE. The revenue level that triggers expansion cannot be estimated." : "Facility ownership, square footage, utilization, utilities, and expansion capacity are NOT AVAILABLE. The revenue trigger for expansion is unknown.", {
      result: "KEY DUE DILIGENCE QUESTION",
      kind: deal.realEstateIncluded ? "SELLER_PROVIDED" : "NOT_PROVIDED",
      next: "Request site plan, utility bills/capacity, lease or deed, and a floor-space utilization walk.",
    })
  );

  q.push(
    make(deal, 26, "Likely 2X team: general manager, technical salesperson/sales engineer, operations or production manager, quality leader, maintenance, operators/technicians, controller, and customer service as volume warrants. First hire should address the measured constraint: GM if owner-dependent, salesperson if capacity is open, or operations/quality if demand already exceeds execution.", {
      result: "FIRST HIRE DEPENDS ON THE BOTTLENECK",
      kind: "ESTIMATE",
      next: "Obtain org chart, seller duties, open positions, and supervisor spans before choosing.",
    }),
    make(deal, 27, /owner.*(sales|designer|handles|relationship)/i.test(deal.notes || "") ? "The listing indicates the owner personally handles a critical function. Hours, quoting, relationships, repairs, scheduling, finance, hiring, and quality responsibilities still need to be mapped." : "Owner hours and responsibility for sales, quoting, customer relationships, repairs, scheduling, finance, hiring, and quality are NOT AVAILABLE.", {
      result: /owner.*(sales|designer|handles|relationship)/i.test(deal.notes || "") ? "HIGH" : "MODERATE — ASSUMED UNTIL PROVEN",
      light: /owner.*(sales|designer|handles|relationship)/i.test(deal.notes || "") ? "red" : "yellow",
      kind: /owner/i.test(deal.notes || "") ? "SELLER_PROVIDED" : "ASSUMPTION",
      next: "Ask seller to log two weeks of work and name the replacement owner for every task. Semi-absentee status is not proven.",
    }),
    make(deal, 28, "Customer tenure, contracts, change-of-control terms, owner-held relationships, switching costs, alternative suppliers, customer-owned tooling/assets, and transition support are NOT AVAILABLE. New ownership can disrupt concentrated or relationship-led accounts even when tenure is long.", {
      result: "CUSTOMER RETENTION RISK NOT YET MEASURED",
      light: "red",
      kind: "NOT_PROVIDED",
      next: "If any customer is material, require a direct customer conversation before closing.",
    }),
    make(deal, 29, "Ask the seller whether the buyer may call/meet major customers, when that can happen, and whether the seller will participate. Questions: Are you satisfied? Will ownership change matter? Will purchases grow? Have you considered another supplier? What additional business could we win? What could cause us to lose you?", {
      result: "CUSTOMER CONVERSATION REQUIRED IF CONCENTRATED",
      light: "yellow",
      kind: "ASSUMPTION",
      next: "Put customer-call access into the LOI/diligence conditions when concentration is material.",
    }),
    make(deal, 30, concentration
      ? `CIM prints top-customer concentration at ${concentration}. Confirm the trailing-twelve mix and whether that account is under contract.`
      : unansweredItem("top-customer % — no source printed a figure"), {
      result: concentration ? `CIM PRINTS ${concentration}` : "UNANSWERED — no printed customer %",
      light: concentration ? "yellow" : "red",
      kind: concentration ? "SELLER_PROVIDED" : "NOT_PROVIDED",
      next: "Request revenue by customer for at least three years. Rate under 20% top customer as preferable, 25–50% high, and over 50% critical.",
    }),
    make(deal, 31, `Top five current risks, ranked on incomplete data: 1) financials are seller-provided and unverified; 2) customer concentration is unknown; 3) owner dependence is unknown; 4) capacity/equipment condition is unknown; 5) ${ind.wantToOwn10Years ? "labor, working capital, and execution during growth" : "industry durability / discretionary demand"}.`, {
      result: "FIVE RISKS — MOST NEED SELLER EVIDENCE",
      light: ind.wantToOwn10Years ? "yellow" : "red",
      kind: "ASSUMPTION",
      next: "Retest probability and financial impact after the seller packet; do not expand to a 30-risk dump.",
    }),
    make(deal, 32, `Top five possible upsides: 1) professionalize sales; 2) win lookalike/second-source customers; 3) improve quote speed and pricing; 4) use verified open capacity or add a shift; 5) add sensible adjacencies (${ind.extraRevenue.slice(0, 2).join(", ") || "not yet identified"}). None is included in current earnings.`, {
      result: "UPSIDE EXISTS — NOT UNDERWRITTEN",
      light: "green",
      kind: "ESTIMATE",
      next: "Treat upside as optionality until a customer, capacity, and contribution-margin case exists.",
    })
  );

  q.push(
    make(deal, 33, `${ind.fragmentation} A platform could share sales, administration, purchasing, equipment, customers, and management across tuck-ins. Reaching $30M–$100M would require repeatable integration, management depth, financing, and multiple acquisitions; the target is not yet proven as the right platform base.`, {
      result: ind.wantToOwn10Years && !ind.fragmentation.toLowerCase().includes("unknown") ? "POSSIBLE" : "LOW POTENTIAL",
      light: ind.wantToOwn10Years ? "yellow" : "red",
      kind: "ESTIMATE",
      next: "First prove this company can run without the owner. A fragile business is not a platform.",
    }),
    make(deal, 34, companyLeaders.length ? "A 20-company starting set is provided. It is not a revenue ranking: current company-reported revenue and exact segment exposure must be verified before calling it the top 20." : "NOT AVAILABLE YET — the industry is too vague for a defensible top-20 list.", {
      result: companyLeaders.length ? "STARTING SET — REVENUE RANK NOT VERIFIED" : "NOT AVAILABLE YET",
      kind: companyLeaders.length ? "ESTIMATE" : "NOT_PROVIDED",
      next: "Verify revenue in public filings/company reports and separate exact-process competitors from broad strategic peers.",
      details: companyLeaders.map((x, i) => `${i + 1}. ${x} | Revenue: verify current public/company-reported figure | Scale: materially larger than target`).join("\n"),
    }),
    make(deal, 35, "A defensible list of 20 private companies near this target's revenue cannot be produced from current data without inventing private-company revenue. Location, employees, capabilities, margins, equipment, growth, and certifications must be sourced company by company.", {
      result: "NOT AVAILABLE YET — PUBLIC PRIVATE-COMPANY DATA IS SPARSE",
      kind: "NOT_PROVIDED",
      next: "Use the seller's competitor list, trade directories, LinkedIn headcount, company sites, and paid private-company data. Label every revenue estimate.",
    }),
    make(deal, 36, `Current market: ${ind.usMarketSize.value}. CAGR: ${ind.cagr.value}. A precise future market value and faster/slower-than-GDP conclusion require a current named source. Target growth is more likely to come from market-share capture and additional services than from industry growth alone.`, {
      result: "SHARE CAPTURE, NOT MARKET BOOM, SHOULD DRIVE THE CASE",
      kind: "ESTIMATE",
      next: "Verify CAGR and calculate 5-/10-year market values from the same source and base year.",
    }),
    make(deal, 37, `Price/revenue: ${revenueMultiple != null ? `${revenueMultiple.toFixed(2)}x` : "not available"}. Price/EBITDA: ${deal.ebitda && deal.askingPrice ? `${(deal.askingPrice / deal.ebitda).toFixed(2)}x` : "not available"}. Price/SDE: ${deal.sde && deal.askingPrice ? `${(deal.askingPrice / deal.sde).toFixed(2)}x` : "not available"}. Earnings margin: ${margin != null ? pct(margin) : "not available"}. FF&E/price: ${assetCoverage != null ? pct(assetCoverage) : "not available"}. Real-estate value: not separately available.`, {
      result: valuation,
      light: valuation === "EXPENSIVE" ? "red" : valuation === "CANNOT DETERMINE YET" ? "yellow" : "green",
      kind: "AI_CALCULATION",
      next: "This is only a listing-level view. Recalculate from buyer-adjusted earnings after NDA.",
    }),
    make(deal, 38, `Listed earnings margin is ${margin != null ? pct(margin) : "NOT AVAILABLE"} and revenue per employee is ${revPerEmployee ? money(revPerEmployee) : "NOT AVAILABLE"}. ${
        margin != null && margin > 0.35 ? "Margin is unusually high and requires immediate verification." : "No obvious arithmetic impossibility is visible, but that does not make the numbers real."
      } FINANCIAL ITEMS WE MUST VERIFY AFTER NDA: three-year revenue, tax-return tie-out, add-backs, gross margin, payroll, maintenance capex, working capital, and revenue relative to equipment/facility scale.`, {
      result: margin != null && margin > 0.35 ? "AGGRESSIVE — VERIFY" : "PLAUSIBLE AT FIRST GLANCE — UNVERIFIED",
      light: margin != null && margin > 0.35 ? "red" : "yellow",
      kind: "AI_CALCULATION",
      next: "Do not perform full QoE yet; request normalized P&Ls and add-back support.",
    }),
    make(deal, 39, `GROWTH SCENARIO — NOT A FORECAST. TODAY: ${money(deal.revenue)} revenue, ${deal.employees ?? "unknown"} employees, current location count unknown. 3-YEAR TARGET: roughly ${deal.revenue ? money(deal.revenue * 1.5) : "not available"} revenue with diversified customers, a professional sales motion, a stronger manager, and capacity added only where demand is proven. 5-YEAR TARGET: roughly ${deal.revenue ? money(deal.revenue * 2) : "not available"} with more customers, management layers, and potentially added equipment/location. Employee and equipment counts cannot be estimated until productivity and bottlenecks are verified.`, {
      result: "SCENARIO ONLY — NOT A FORECAST",
      kind: "AI_CALCULATION",
      next: "Replace scenario assumptions with a bottom-up customer, capacity, people, and capital plan after diligence.",
    })
  );

  let score = 42;
  if (ind.wantToOwn10Years) score += 18;
  else score -= 12;
  if (earnings && deal.revenue) score += 10;
  else score -= 12;
  if (valuation === "VERY ATTRACTIVE") score += 14;
  else if (valuation === "ATTRACTIVE") score += 10;
  else if (valuation === "FAIR") score += 4;
  else if (valuation === "EXPENSIVE") score -= 12;
  if (deal.realEstateIncluded) score += 4;
  if (deal.sellerFinancing) score += 4;
  if (/owner.*(sales|designer|handles|relationship)/i.test(deal.notes || "")) score -= 6;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const decision =
    score >= 82
      ? "HIGH_PRIORITY_REQUEST_NDA"
      : score >= 67
        ? "REQUEST_NDA"
        : score >= 48
          ? "MAYBE"
          : "PASS";
  const whatWeLike = [
    ind.wantToOwn10Years ? "Customers should still need the category in 10–20 years." : "",
    earnings && deal.revenue ? "Listing includes enough financial data for first-pass math." : "",
    valuation === "VERY ATTRACTIVE" || valuation === "ATTRACTIVE" ? "Asking multiple is attractive at first glance." : "",
    deal.realEstateIncluded ? "Real estate may add downside protection." : "",
    deal.sellerFinancing ? "Seller financing may improve alignment and structure." : "",
  ].filter(Boolean).slice(0, 5);
  const concerns = [
    "Customer concentration is not available.",
    "Capacity and bottlenecks are not verified.",
    "Owner dependence is not fully mapped.",
    deal.ffe ? "Seller equipment value is not an appraisal." : "Equipment/assets are not adequately described.",
    !ind.wantToOwn10Years ? "Long-term industry need is questionable." : "Financials are seller-provided, not verified.",
  ].slice(0, 5);
  const unanswered = [
    "What are the top 1, 3, and 5 customer percentages?",
    "What exactly does the owner do each week?",
    "What is the real bottleneck and current utilization?",
    "Provide the equipment schedule with model, year, condition, and liens.",
    "Can major customers be contacted before closing?",
    "Do listed earnings tie to tax returns?",
    "What maintenance capex is required?",
    "What working capital remains in the deal?",
  ].slice(0, 8);
  const decisionWhy =
    decision === "HIGH_PRIORITY_REQUEST_NDA"
      ? "Needed category, usable listing economics, and attractive first-pass valuation justify fast NDA follow-up."
      : decision === "REQUEST_NDA"
        ? "The business is understandable enough and potentially durable enough to justify the low cost of an NDA."
        : decision === "MAYBE"
          ? "Get basic customer, owner, earnings, and capacity answers before spending more time."
          : "The durability, economics, or available information does not justify an NDA request.";

  q.push(
    make(deal, 40, `${decisionWhy} This decision is based on public/listing-level evidence only; unresolved questions remain explicit.`, {
      result: decision.replace(/_/g, " "),
      light: decision === "PASS" ? "red" : decision === "MAYBE" ? "yellow" : "green",
      kind: "AI_CALCULATION",
      known: whatWeLike,
      unknown: unanswered,
      next: decision.includes("REQUEST_NDA") ? "Request the NDA and information packet." : decision === "MAYBE" ? "Ask the basic unanswered questions first." : "Pass and preserve the record.",
    })
  );

  const sections = SECTION_META.map((section) => {
    const questions = q.filter((item) => item.section === section.id);
    const light = strongestLight(questions.map((item) => item.light));
    return {
      id: section.id,
      title: section.title,
      questionIds: questions.map((item) => item.id),
      light,
      summary:
        light === "green"
          ? "Good at first glance."
          : light === "yellow"
            ? "Important information is still missing."
            : light === "red"
              ? "At least one concern needs an answer."
              : "Possible deal killer.",
    };
  });

  for (const question of q) {
    question.answer = tightenAnswer(question.answer, deal.name, 3);
    if (isTemplateWhy(question.why)) question.why = defaultWhy();
  }

  return {
    completedAt: new Date().toISOString(),
    status: "complete",
    questions: q,
    sections,
    prospects,
    whatWeLike,
    concerns,
    unanswered,
    score,
    decision,
    decisionWhy,
    researchStatus: deal.publicResearch?.status,
    companyBrief: firstSentences(
      cimProse(deal, 5) ||
        (deal.publicResearch?.status === "complete"
          ? "CIM is not on the card. Public sources were fetched as a labeled supplement only — they do not replace a book."
          : unansweredItem(
              "a 3–5 sentence CIM picture of what they sell, who pays, how it runs, and the ugly"
            )),
      5
    ),
  };
}

export function ownerDecisionToPreNda(
  decision: OwnerQuestionReport["decision"]
): "REQUEST_NDA" | "MAYBE" | "PASS" {
  if (decision === "PASS") return "PASS";
  if (decision === "MAYBE") return "MAYBE";
  return "REQUEST_NDA";
}
