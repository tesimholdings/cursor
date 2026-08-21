import type { Deal, PreNdaDecision, ScreeningQuestion, Stage1Screening, TrafficLight } from "./types";
import { matchIndustry } from "./industry";
import { money, multiple } from "./format";
import { scoreStage1 } from "./scoring";

function q(
  id: number,
  title: string,
  answer: string,
  why: string,
  known: string[],
  unknown: string[],
  next: string,
  light: TrafficLight,
  kind: ScreeningQuestion["kind"],
  details?: string
): ScreeningQuestion {
  return { id, title, answer, why, known, unknown, next, light, kind, details };
}

function sellerMemoExcerpt(deal: Deal) {
  const memo = [...deal.documents]
    .filter(
      (document) =>
        document.category === "cim" &&
        (document.textExcerpt || document.extraction?.chunks.length)
    )
    .sort(
      (a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt)
    )[0];
  return (
    memo?.textExcerpt ||
    memo?.extraction?.chunks.map((chunk) => chunk.text).join(" ")
  )
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

export function buildStage1(deal: Deal): Stage1Screening {
  if (!deal.ownerQuestions || deal.ownerQuestions.status !== "complete") {
    throw new Error("STEP 1A — Owner Questions must complete before Step 1B.");
  }
  const ind = matchIndustry(deal.industry, deal.name, deal.notes);
  const citedProspects = deal.ownerQuestions.prospects;
  const earnings = deal.sde || deal.ebitda;
  const revMult = multiple(deal.askingPrice, deal.revenue);
  const earnMult = multiple(deal.askingPrice, earnings);
  const sdeMargin = deal.sde && deal.revenue ? deal.sde / deal.revenue : null;
  const ffePct = deal.ffe && deal.askingPrice ? deal.ffe / deal.askingPrice : null;
  const memoExcerpt = sellerMemoExcerpt(deal);

  let valuation: Stage1Screening["valuationLabel"] = "Unknown";
  if (earnMult != null) {
    if (earnMult < 2.8) valuation = "Cheap";
    else if (earnMult <= 4.5) valuation = "Reasonable";
    else valuation = "Expensive";
  } else if (revMult != null) {
    if (revMult < 0.7) valuation = "Cheap";
    else if (revMult <= 1.2) valuation = "Reasonable";
    else valuation = "Expensive";
  }

  const tax: Stage1Screening["taxAttractiveness"] =
    deal.realEstateIncluded || (deal.ffe && deal.ffe > 500_000) ? "High" : deal.ffe ? "Moderate" : "Low";

  const missingFinancials = !deal.revenue && !earnings;
  const sizeOk =
    deal.askingPrice == null || (deal.askingPrice >= 1_000_000 && deal.askingPrice <= 20_000_000);

  const questions: ScreeningQuestion[] = [
    q(
      1,
      "What does this company actually do?",
      memoExcerpt || deal.notes
        ? `${deal.name} is described in supplied seller material as: ${memoExcerpt || deal.notes} In plain English, they likely sell ${ind.label.toLowerCase()} work to customers and get paid when they produce or service that work.`
        : `${deal.name} appears to be a ${ind.label.toLowerCase()} business in ${deal.location || "an unspecified location"}. They sell work or products in that category to customers who need it for their own operations. Employees typically quote, produce/service, ship, and invoice. We do not yet have a shop-floor description.`,
      "If we cannot explain the business in one paragraph, we should not buy it.",
      [
        deal.name && `Name: ${deal.name}`,
        deal.industry && `Industry listed: ${deal.industry}`,
        deal.location && `Location: ${deal.location}`,
        memoExcerpt
          ? "Attached CIM excerpt exists"
          : deal.notes && "Listing notes exist",
      ].filter(Boolean) as string[],
      ["Day-to-day operations", "Exact products/SKUs", "How jobs actually flow through the building"],
      "If the listing is vague, the NDA packet must include photos, equipment list, and a simple process walkthrough.",
      memoExcerpt || deal.notes ? "green" : "yellow",
      memoExcerpt || deal.notes ? "SELLER_PROVIDED" : "ESTIMATE"
    ),
    q(
      2,
      "Is this industry actually needed?",
      `${ind.needed} Demand looks ${ind.discretionary}. ${ind.obsolescence} ${ind.disruption} ${ind.regulatory} ${ind.economicSensitivity} Bottom line: ${ind.wantToOwn10Years ? "this is a category we can own for 10+ years if the specific company is healthy." : "we should be cautious about owning this category for 10+ years until the need is clearer."}`,
      "We only want businesses customers still need in a decade.",
      [ind.label, `10-year ownership view: ${ind.wantToOwn10Years ? "plausible" : "not yet"}`],
      ["Company-specific end markets", "Customer contracts"],
      "Confirm end markets in the CIM. If the industry is discretionary or dying, PASS now.",
      ind.wantToOwn10Years ? "green" : "red",
      "EXTERNAL_RESEARCH"
    ),
    q(
      3,
      "How big is the industry?",
      `U.S. market size (directional): ${ind.usMarketSize.value}. Growth: ${ind.cagr.value}. Structure: ${ind.fragmentation} These are ${ind.usMarketSize.kind} figures, not a paid market study.`,
      "A tiny dying niche is harder to grow than a fragmented needed industry.",
      [ind.usMarketSize.note],
      ["Verified TAM from a named report", "Exact competitor census"],
      "Do not pay for a full industry study until this deal survives Stage 1.",
      ind.usMarketSize.value === "NOT PROVIDED" ? "yellow" : "green",
      ind.usMarketSize.kind
    ),
    q(
      4,
      "How many companies are like this one?",
      `National: ${ind.competitorsNational} Regional: ${ind.competitorsRegional} Similar revenue size: ${ind.sameSizeCount} Large players: ${ind.largeCompetitors} We have not independently counted competitors for this specific ZIP code.`,
      "Too few peers can mean a thin market; too many can mean price wars. Fragmented needed industries are usually what we want.",
      [],
      ["Named top 20 competitors", "Local share of wallet"],
      "Ask the broker for the competitive set. After NDA, build a real competitor list.",
      "yellow",
      "ESTIMATE"
    ),
    q(
      5,
      "Who is the ideal customer?",
      `ICP: ${ind.icp}`,
      "If we do not know who should buy, we cannot judge growth or concentration risk.",
      [],
      ["Actual customer list", "Average account size for THIS company"],
      "Request customer categories (not names) even before NDA if the broker will share them.",
      ind.icp.startsWith("NOT PROVIDED") ? "yellow" : "green",
      "ESTIMATE"
    ),
    q(
      6,
      "How many potential customers exist?",
      `Broad U.S. universe: ${ind.customerUniverse} Realistic ICP: ${ind.icpUniverse} High-priority prospects: ${ind.highPriorityUniverse} A $4–8M company often only needs 5–20 meaningful new accounts to change the trajectory — not thousands.`,
      "A large market is useless if the company cannot reach buyers or does not have capacity.",
      [],
      ["How many customers they have today", "Average revenue per customer"],
      "This becomes a diligence question: customer count and revenue by customer.",
      "yellow",
      "ESTIMATE"
    ),
    q(
      7,
      "Who could become new customers?",
      citedProspects.length
        ? `${citedProspects.length} potential companies were found in cited Step 1A research. They are prospects only, not confirmed customers or confirmed fits.`
        : "NOT PROVIDED — cited public research did not identify defensible named prospects. Fabricating a customer list would be worse than leaving this blank.",
      "Growth has to attach to real buyers, not a TAM slide.",
      [],
      ["Whether this shop can actually serve those buyers (certs, size, equipment)"],
      "After NDA, compare equipment and certs to this list before promising growth.",
      citedProspects.length ? "green" : "yellow",
      citedProspects.length ? "EXTERNAL_RESEARCH" : "NOT_PROVIDED",
      citedProspects
        .map((p) => `${p.company} — inferred ${p.fit} fit — ${p.whyFit}`)
        .join("\n")
    ),
    q(
      8,
      "Does the company currently do sales?",
      `${ind.salesNorm} Listing notes: ${deal.notes || "none"}. Dedicated salespeople, CRM, marketing spend, outbound, website/SEO, and trade shows are NOT PROVIDED.`,
      "If the owner is the only salesperson, that is both a risk and an opportunity.",
      [],
      ["Headcount in sales", "Marketing spend", "CRM", "Who owns customer relationships"],
      "KEY DUE DILIGENCE QUESTION: org chart and who talks to customers.",
      "yellow",
      "NOT_PROVIDED"
    ),
    q(
      9,
      "What would it take to grow sales?",
      `Practical path: ${ind.growthLevers.join("; ")}. Roughly: +25% often needs better quoting and one hunter; +50% needs capacity (shift or machine) plus sales; 2x usually needs people, working capital, and proven demand — not just a new machine.`,
      "We should not buy a machine hoping customers appear. Win demand, then finance capacity.",
      [],
      ["Current utilization", "Quote win rate"],
      "Do not model 2x revenue in the purchase price.",
      "green",
      "AI_CALCULATION"
    ),
    q(
      10,
      "What other revenue could we add?",
      ind.extraRevenue.length
        ? `Industry-sensible add-ons: ${ind.extraRevenue.join("; ")}. Only pursue these after the core shop is stable.`
        : "NOT PROVIDED until we know the capability stack.",
      "Extra revenue streams are optional. They should not be required to make the deal work.",
      [],
      ["What they already offer vs. what customers already buy elsewhere"],
      "Ask in the packet: current service mix.",
      ind.extraRevenue.length ? "green" : "yellow",
      "ESTIMATE"
    ),
    q(
      11,
      "How does customer onboarding work?",
      `${ind.onboarding} Typical sales cycle: ${ind.typicalSalesCycle}. Setup cost, qualification, and switching difficulty are NOT PROVIDED for this company.`,
      "Long onboarding plus owner-led sales means growth is slower than a spreadsheet suggests.",
      [],
      ["Actual cycle time", "Tooling ownership", "Contract terms"],
      "KEY DUE DILIGENCE QUESTION if manufacturing: who owns the tools?",
      "yellow",
      "ESTIMATE"
    ),
    q(
      12,
      "How scalable is the business?",
      `Business scalability: +25% is often possible with sales and overtime; +50% needs a shift or a cell; 2x and 5x usually need equipment, supervisors, and working capital. Physical scalability is NOT PROVIDED (facility, power, machines, people). Additional hours do not equal revenue without demand.`,
      "Price should assume a solid current business, not a heroic scale-up.",
      [],
      ["Utilization", "Facility limits", "Supervisor bench"],
      "THIS IS A KEY DUE DILIGENCE QUESTION: capacity and bottlenecks.",
      "yellow",
      "NOT_PROVIDED"
    ),
    q(
      13,
      "What is current production/output capacity?",
      "THIS IS A KEY DUE DILIGENCE QUESTION. Current utilization, max practical capacity, bottlenecks, hours operated, extra shifts, 24/7 potential, and revenue before new equipment are NOT PROVIDED. We will not invent capacity.",
      "Capacity is how we know whether growth is real or a story.",
      [],
      ["Machine hours", "Shifts", "Bottleneck workcenter"],
      "Request equipment list and hours in the NDA packet.",
      "yellow",
      "NOT_PROVIDED"
    ),
    q(
      14,
      "If we operated more hours, what happens?",
      "Additional hours do NOT automatically equal additional revenue unless customer demand exists. Theoretical math (e.g. 5×8 to 24/5) is easy; sold hours are not. Schedule is NOT PROVIDED.",
      "Sellers sometimes sell 'unused capacity' as if it were cash.",
      [],
      ["Current hours", "Overtime already used", "Labor availability on nights/weekends"],
      "Treat unused hours as optionality, not as earnings.",
      "yellow",
      "ASSUMPTION"
    ),
    q(
      15,
      "What equipment does the business own?",
      deal.ffe
        ? `Seller-stated FF&E is ${money(deal.ffe)}. Manufacturer, model, age, capability, used FMV, and new replacement cost are NOT PROVIDED. Stated FF&E is not the same as fair-market value.`
        : "Equipment list is NOT PROVIDED. FF&E value is NOT PROVIDED.",
      "We may be buying a job shop whose value is mostly machines — or mostly goodwill.",
      deal.ffe ? [`Listed FF&E ${money(deal.ffe)}`] : [],
      ["Machine list with years", "Appraisals"],
      "Require an equipment list with the packet. Do not use replacement cost as value.",
      deal.ffe ? "yellow" : "yellow",
      deal.ffe ? "SELLER_PROVIDED" : "NOT_PROVIDED"
    ),
    q(
      16,
      "What are the limitations of the current machinery?",
      "NOT PROVIDED. We cannot say whether existing equipment can handle the customers we want until we know tonnage/envelope, materials, accuracy, speed, and automation.",
      "Winning the wrong customers (parts we cannot make) wastes a sales hire.",
      [],
      ["Each major machine's envelope and process window"],
      "KEY DUE DILIGENCE QUESTION for manufacturers.",
      "yellow",
      "NOT_PROVIDED"
    ),
    q(
      17,
      "What machinery should we buy next?",
      "Do not buy a machine before demand exists unless a bottleneck is already sold-out. Preferred logic: win demand → finance machine → fulfill. Any next-machine recommendation before utilization data would be a guess.",
      "Idle new iron destroys cash.",
      [],
      ["Bottleneck", "Quoted-but-lost jobs due to capacity"],
      "After NDA, look at lost quotes and overtime before shopping equipment.",
      "green",
      "ASSUMPTION"
    ),
    q(
      18,
      "Can machinery be financed?",
      "Usually yes, if the machines are common and not obsolete: equipment loan, lease, SBA, bank, manufacturer financing, or even customer-owned tooling. Customer-funded equipment is often the best. None of this is confirmed for this seller.",
      "Financing iron is easier than financing hope.",
      [],
      ["Lien search", "Who actually owns the machines"],
      "Attorney/CPA: UCC search after we like the packet.",
      "green",
      "EXTERNAL_RESEARCH"
    ),
    q(
      19,
      "Are they overvaluing their assets?",
      deal.ffe && deal.askingPrice
        ? `FF&E is ${money(deal.ffe)} (${(ffePct! * 100).toFixed(0)}% of ask). That could be fair or aggressive. Used FMV, orderly liquidation, and value-in-use are NOT PROVIDED. Replacement cost is not FMV.`
        : "Cannot judge asset inflation yet. NOT PROVIDED.",
      "Sellers often quote what they paid new, not what a buyer would pay used.",
      deal.ffe ? [`FF&E ${money(deal.ffe)}`] : [],
      ["Appraisal", "Comparable used listings"],
      "If FF&E is a big slice of price, get an equipment appraiser before closing.",
      "yellow",
      deal.ffe ? "SELLER_PROVIDED" : "NOT_PROVIDED"
    ),
    q(
      20,
      "What happens if we add more customers?",
      scenarioBlock(deal.revenue),
      "Concentration often improves when new accounts land — but only if capacity and quality hold.",
      deal.revenue ? [`Current listed revenue ${money(deal.revenue)}`] : [],
      ["Capacity to absorb new work", "Current customer count"],
      "Treat this as a demand scenario, not a forecast.",
      "green",
      "AI_CALCULATION"
    ),
    q(
      21,
      "What are the biggest roadblocks to growth?",
      "Until the packet arrives, the usual suspects are: unknown machine/facility/electrical capacity, owner-led sales, labor, certifications, working capital, customer concentration, and management depth. Company-specific roadblocks are NOT PROVIDED.",
      "The first roadblock is the one we must price or fix.",
      [],
      ["The actual constraint"],
      "Ask the seller: what stopped you from growing?",
      "yellow",
      "ESTIMATE"
    ),
    q(
      22,
      "Could we realistically win new customers?",
      "A large industry does not mean this shop can win. We need a reason to switch: lead time, quality, price, or a salesperson who shows up. Certifications, competitive pricing, and qualification barriers are NOT PROVIDED. Realistic strategy: protect current work, then hunt lookalike accounts the equipment can actually run.",
      "Growth stories are where buyers overpay.",
      [],
      ["Win/loss reasons", "Certifications", "Lead times vs. competitors"],
      "Do not pay for unproven growth.",
      "yellow",
      "ASSUMPTION"
    ),
    q(
      23,
      "Would new ownership disrupt current customers?",
      "NOT PROVIDED — and this is critical if one customer is large. We need contracts, tenure, who owns the relationship, change-of-control clauses, switching costs, and customer-owned tooling. If a customer is a major percentage of revenue: CUSTOMER INTERVIEW REQUIRED BEFORE CLOSING. Ask: can we speak directly with major customers?",
      "Concentrated businesses can disappear when the seller leaves.",
      [],
      ["Customer concentration", "Contracts", "Who holds the relationship"],
      "If the seller refuses major customer conversations later, that is a fatal-risk flag.",
      "red",
      "NOT_PROVIDED"
    ),
    q(
      24,
      "What do the numbers look like at first glance?",
      [
        deal.askingPrice ? `Ask ${money(deal.askingPrice)}` : "Ask NOT PROVIDED",
        deal.revenue ? `Revenue ${money(deal.revenue)}` : "Revenue NOT PROVIDED",
        deal.sde ? `SDE ${money(deal.sde)}` : "SDE NOT PROVIDED",
        deal.ebitda ? `EBITDA ${money(deal.ebitda)}` : "EBITDA NOT PROVIDED",
        revMult != null ? `Ask/revenue ${revMult.toFixed(2)}x` : "Ask/revenue unknown",
        earnMult != null ? `Ask/earnings ${earnMult.toFixed(2)}x` : "Ask/earnings unknown",
        sdeMargin != null ? `SDE margin ${(sdeMargin * 100).toFixed(1)}%` : "SDE margin unknown",
        `Valuation at a glance: ${valuation}`,
      ].join(". ") + ". This is not quality of earnings.",
      "We only need to know if the listing is in the universe we care about.",
      [],
      ["Whether SDE is real", "Add-backs", "Working capital"],
      "If the multiple is silly or numbers are missing, MAYBE or PASS.",
      valuation === "Expensive" ? "red" : valuation === "Unknown" ? "yellow" : "green",
      deal.askingPrice ? "AI_CALCULATION" : "NOT_PROVIDED"
    ),
    q(
      25,
      "Is the business attractive from a tax perspective?",
      `High-level only: ${tax}. Drivers: equipment depreciation, possible real estate / cost segregation, bonus depreciation, goodwill amortization, and interest deductions. No structuring yet. A CPA must verify later.`,
      "Tax is a sweetener, never the reason to buy a bad company.",
      [
        deal.realEstateIncluded ? "Real estate listed as included" : "Real estate inclusion unclear",
        deal.ffe ? `FF&E ${money(deal.ffe)}` : "FF&E unknown",
      ],
      ["Asset vs stock", "Allocation", "State taxes"],
      "Stage 3 tax model only if the deal survives.",
      tax === "High" ? "green" : "yellow",
      "ESTIMATE"
    ),
  ];

  const scored = scoreStage1({
    wantToOwn: ind.wantToOwn10Years,
    valuation,
    missingFinancials,
    sizeOk,
    realEstate: deal.realEstateIncluded,
    sellerFinancing: deal.sellerFinancing,
    askingPrice: deal.askingPrice,
    revenue: deal.revenue,
    earnings,
    industryQualityBase: ind.wantToOwn10Years ? 78 : 42,
  });

  let decision: PreNdaDecision = scored.decision;
  let decisionWhy = scored.why;
  if (!ind.wantToOwn10Years && (valuation === "Expensive" || missingFinancials)) {
    decision = "PASS";
    decisionWhy =
      "The category is not something we clearly want to own for 10 years, and the listing is not cheap enough (or complete enough) to justify a look.";
  }
  if (deal.ownerQuestions.decision === "PASS") {
    decision = "PASS";
    decisionWhy =
      "Step 1A identified a pass. The normal listing screen cannot override the owner's core questions.";
  } else if (
    deal.ownerQuestions.decision === "MAYBE" &&
    decision === "REQUEST_NDA"
  ) {
    decision = "MAYBE";
    decisionWhy =
      "The listing math is acceptable, but Step 1A still needs basic owner, customer, or capacity answers.";
  }

  return {
    researchedAt: new Date().toISOString(),
    researchMode: "listing_and_industry",
    questions,
    icp: ind.icp,
    prospects: citedProspects.slice(0, 30),
    valuationLabel: valuation,
    taxAttractiveness: tax,
    industryQuality: scored.industryQuality,
    growthScore: scored.growth,
    assetsScore: scored.assets,
    preNdaScore: scored.score,
    decision,
    decisionWhy,
    whatWeKnow: [
      deal.industry && `Listed as ${deal.industry}`,
      deal.askingPrice && `Asking ${money(deal.askingPrice)}`,
      deal.revenue && `Revenue ${money(deal.revenue)}`,
      earnings && `Earnings ${money(earnings)}`,
      `${ind.label} category view is on file`,
    ]
      .filter(Boolean)
      .join(". "),
    whatWeDont:
      "We do not have capacity, customer names, verified financials, equipment condition, or proof that sales is professional.",
    whyItMatters:
      "Stage 1 only answers: is this worth an NDA and an information packet? Full diligence comes later.",
    whatNext:
      decision === "REQUEST_NDA"
        ? "Request the NDA and information packet."
        : decision === "MAYBE"
          ? "Get one or two missing answers (usually earnings, real estate, or a plain-English description) before spending more time."
          : "Pass. Do not request an NDA.",
  };
}

function scenarioBlock(revenue?: number | null) {
  const base = revenue ?? 0;
  const avgs = [100_000, 250_000, 500_000, 750_000, 1_000_000];
  const counts = [5, 10, 20];
  const lines = ["REVENUE DEMAND SCENARIO — CAPACITY NOT YET VERIFIED"];
  for (const c of counts) {
    for (const a of avgs) {
      const inc = c * a;
      lines.push(
        `${c} new customers @ ${money(a)} each → +${money(inc)} incremental; total ${base ? money(base + inc) : "unknown (no current revenue)"}`
      );
    }
  }
  return lines.join(". ");
}
