export interface IndustryProfile {
  key: string;
  label: string;
  needed: string;
  wantToOwn10Years: boolean;
  discretionary: "essential" | "mixed" | "discretionary";
  obsolescence: string;
  disruption: string;
  regulatory: string;
  economicSensitivity: string;
  usMarketSize: { value: string; kind: "ESTIMATE" | "EXTERNAL_RESEARCH"; note: string };
  cagr: { value: string; kind: "ESTIMATE"; note: string };
  fragmentation: string;
  competitorsNational: string;
  competitorsRegional: string;
  sameSizeCount: string;
  largeCompetitors: string;
  icp: string;
  customerUniverse: string;
  icpUniverse: string;
  highPriorityUniverse: string;
  salesNorm: string;
  growthLevers: string[];
  extraRevenue: string[];
  onboarding: string;
  typicalSalesCycle: string;
  typicalProspects: Array<{
    company: string;
    industry: string;
    revenue?: string;
    location: string;
    whyFit: string;
    potentialOffering: string;
    fit: "High" | "Medium" | "Low";
  }>;
}

const PROFILES: IndustryProfile[] = [
  {
    key: "mold",
    label: "Custom injection molding / plastics",
    needed:
      "Manufacturers need plastic parts for cars, appliances, medical devices, packaging, and industrial equipment. This is a real, ongoing need — not a fad.",
    wantToOwn10Years: true,
    discretionary: "essential",
    obsolescence:
      "Plastic parts will still be needed. Some products may shift to different resins, recycled content, or metal/composite substitutes, but the process remains core manufacturing.",
    disruption:
      "Automation, resin price swings, and reshoring help well-run shops. 3D printing takes prototypes and tiny runs, not most production volume.",
    regulatory: "Resin handling, OSHA, and customer quality systems (IATF, ISO, medical) matter more than a single 'ban plastics' headline.",
    economicSensitivity:
      "Follows industrial production. Auto and housing slowdowns hurt. Diversified end markets help.",
    usMarketSize: {
      value: "~$80–100B U.S. plastics product manufacturing (process is a large slice)",
      kind: "ESTIMATE",
      note: "Order-of-magnitude industry size, not a company-specific audit.",
    },
    cagr: {
      value: "~2–4% through the next 5–10 years, with recycled-content and medical/industrial niches faster",
      kind: "ESTIMATE",
      note: "Directionally useful; verify with a market report before an LOI.",
    },
    fragmentation: "Very fragmented. Thousands of custom molders; a handful of large strategic players.",
    competitorsNational: "Roughly 2,000–3,000 custom injection molders nationally (ESTIMATE).",
    competitorsRegional: "Typically dozens within a 300-mile radius, depending on the state.",
    sameSizeCount: "Hundreds of shops in the $3–8M revenue band.",
    largeCompetitors: "Larger platforms and public plastics companies (e.g. automotive interiors, packaging) sit well above this size.",
    icp: "U.S. OEMs and tier suppliers in industrial, auto, medical, consumer durables, and appliances that need repeating plastic parts, often $50k–$1M+ annual accounts once tooled.",
    customerUniverse: "Tens of thousands of U.S. manufacturers that buy molded parts.",
    icpUniverse: "A realistic ICP is usually a few thousand plants in relevant NAICS codes within a practical shipping radius plus national accounts that will tool remotely.",
    highPriorityUniverse: "Often 50–200 named accounts that match current presses, resins, and quality systems.",
    salesNorm: "Many shops this size still rely on the owner, referrals, and a thin website. Dedicated sales is often the unlock.",
    growthLevers: [
      "Hire a salesperson who can talk tooling and lead times",
      "Quote faster and follow up",
      "Add a second shift before buying a new press",
      "Win 3–5 new accounts in adjacent industries",
    ],
    extraRevenue: [
      "Assembly and kitting",
      "Warehousing / kanban",
      "Tooling management",
      "Secondary ops (decorating, welding)",
      "Material conversion / recycled content",
    ],
    onboarding:
      "Lead → RFQ → quote → tool / transfer tool → PPAP or first article → production → blanket PO / releases → billing. Tooling is the switching cost.",
    typicalSalesCycle: "3–12 months for a new tooled program; faster for overflow capacity.",
    typicalProspects: [
      { company: "Regional automotive tier suppliers", industry: "Auto parts", revenue: "$50M–$500M typical", location: "Midwest / South", whyFit: "High volume plastic components", potentialOffering: "Production molding + tool transfer", fit: "High" },
      { company: "Appliance component makers", industry: "Appliances", location: "Midwest", whyFit: "Housing and interiors plastics", potentialOffering: "Multi-cavity production", fit: "High" },
      { company: "Industrial equipment OEMs", industry: "Machinery", location: "National", whyFit: "Guards, housings, handles", potentialOffering: "Lower-volume engineered parts", fit: "High" },
      { company: "Medical device assemblers (if certified)", industry: "Med device", location: "National", whyFit: "Repeatable quality parts", potentialOffering: "Cleaner process + validation", fit: "Medium" },
      { company: "Consumer durables brands", industry: "Consumer", location: "National", whyFit: "Housings and packaged goods", potentialOffering: "Capacity overflow", fit: "Medium" },
    ],
  },
  {
    key: "cnc",
    label: "Precision CNC / machine shop",
    needed: "Almost every physical product still needs metal parts cut to spec. This work does not go away.",
    wantToOwn10Years: true,
    discretionary: "essential",
    obsolescence: "CNC machining remains essential. Some work shifts overseas or to additive, but production and repair stay local.",
    disruption: "5-axis, automation, and lights-out machining reward shops that invest. Low-mix wrench-turning is more exposed.",
    regulatory: "ITAR, aerospace quality (AS9100), and material certs can be moats — or blockers.",
    economicSensitivity: "Tied to aerospace, energy, and industrial capex cycles.",
    usMarketSize: {
      value: "U.S. machine shops / precision machining is a large multi-tens-of-billions market",
      kind: "ESTIMATE",
      note: "Fragmented job-shop market; treat as directional.",
    },
    cagr: { value: "~2–5% with aerospace/defense pockets higher", kind: "ESTIMATE", note: "Verify before LOI." },
    fragmentation: "Extremely fragmented job shops plus a smaller set of larger contract manufacturers.",
    competitorsNational: "Tens of thousands of machine shops; far fewer with real quality systems and capacity.",
    competitorsRegional: "Dozens to hundreds in an industrial metro.",
    sameSizeCount: "Many shops at $2–10M revenue.",
    largeCompetitors: "Large CMs (aerospace/defense) compete for the best programs.",
    icp: "OEMs needing repeating precision parts, typically industrial, aero, energy, or medical, with annual accounts from $75k to $1M+.",
    customerUniverse: "Broad U.S. manufacturing base.",
    icpUniverse: "Thousands of plants that outsource machining.",
    highPriorityUniverse: "Often 30–100 accounts that match machines, tolerances, and certifications.",
    salesNorm: "Owner-led quoting is common. A salesperson plus an estimator is a typical upgrade.",
    growthLevers: ["Estimator + CRM", "Second shift", "Certification if missing", "Target 3 industries not just one customer"],
    extraRevenue: ["Assembly", "Finishing management", "Inventory programs", "Design-for-manufacturability"],
    onboarding: "Print → quote → first article → production releases. Switching costs rise after FAIR/PPAP.",
    typicalSalesCycle: "1–9 months.",
    typicalProspects: [
      { company: "Aerospace suppliers", industry: "Aero", location: "National", whyFit: "Precision, certs, repeat work", potentialOffering: "Production machining", fit: "High" },
      { company: "Energy equipment OEMs", industry: "Energy", location: "TX / OK / PA", whyFit: "Valves, fittings, housings", potentialOffering: "Cell-based production", fit: "High" },
      { company: "Industrial pump/valve makers", industry: "Industrial", location: "Midwest", whyFit: "Metal components", potentialOffering: "Recurring SKUs", fit: "High" },
    ],
  },
  {
    key: "hvac",
    label: "Commercial HVAC / mechanical",
    needed: "Buildings must heat, cool, and ventilate. Service and replacement are not optional in occupied buildings.",
    wantToOwn10Years: true,
    discretionary: "mixed",
    obsolescence: "Refrigerant transitions change equipment, not the need for the trade.",
    disruption: "Electrification and controls software help contractors who train; they do not erase the work.",
    regulatory: "Licensing, EPA refrigerant rules, prevailing wage on some jobs.",
    economicSensitivity: "New construction is cyclical; maintenance and repair are stickier.",
    usMarketSize: {
      value: "U.S. HVAC services is a very large market (tens of billions)",
      kind: "ESTIMATE",
      note: "National contractor market; local share is what matters.",
    },
    cagr: { value: "~3–6% with retrofit/electrification tailwinds", kind: "ESTIMATE", note: "Directional." },
    fragmentation: "Highly local. Thousands of contractors; private-equity rollups are active.",
    competitorsNational: "National brands plus countless independents.",
    competitorsRegional: "The real competitive set is usually 5–20 contractors in the metro.",
    sameSizeCount: "Plenty of $3–12M shops.",
    largeCompetitors: "PE-backed platforms and national mechanicals.",
    icp: "Building owners, property managers, light industrial, and commercial accounts with recurring service plus project work.",
    customerUniverse: "Every commercial building in the service radius.",
    icpUniverse: "Hundreds to a few thousand serviceable buildings.",
    highPriorityUniverse: "Top 50–150 accounts by spend and proximity.",
    salesNorm: "Mix of service managers, estimators, and owner relationships. Professional outbound is often weak.",
    growthLevers: ["Maintenance agreements", "Dispatcher/software", "Electrification retrofits", "Hire licensed techs"],
    extraRevenue: ["Controls", "IAQ", "Plumbing if licensed", "Membership plans"],
    onboarding: "Call → diagnose → quote → schedule → invoice. Service agreements create recurrence.",
    typicalSalesCycle: "Days for repair; months for projects.",
    typicalProspects: [
      { company: "Local school districts", industry: "Education", location: "Service radius", whyFit: "Aging mechanical plants", potentialOffering: "Service + capital projects", fit: "High" },
      { company: "Multifamily operators", industry: "Real estate", location: "Metro", whyFit: "Recurring service", potentialOffering: "Maintenance agreements", fit: "High" },
      { company: "Light industrial plants", industry: "Industrial", location: "Metro", whyFit: "Process cooling / comfort", potentialOffering: "Project + service", fit: "Medium" },
    ],
  },
  {
    key: "generic",
    label: "Lower-middle-market operating company",
    needed: "Unknown until we understand what customers actually buy and whether they must keep buying it.",
    wantToOwn10Years: false,
    discretionary: "mixed",
    obsolescence: "NOT PROVIDED until industry is identified.",
    disruption: "NOT PROVIDED.",
    regulatory: "NOT PROVIDED.",
    economicSensitivity: "Most small businesses feel recessions; we need end-market detail.",
    usMarketSize: { value: "NOT PROVIDED", kind: "ESTIMATE", note: "Industry not mapped yet." },
    cagr: { value: "NOT PROVIDED", kind: "ESTIMATE", note: "Need a defined industry." },
    fragmentation: "Unknown.",
    competitorsNational: "NOT PROVIDED",
    competitorsRegional: "NOT PROVIDED",
    sameSizeCount: "NOT PROVIDED",
    largeCompetitors: "NOT PROVIDED",
    icp: "NOT PROVIDED — we need to know who pays the invoices.",
    customerUniverse: "NOT PROVIDED",
    icpUniverse: "NOT PROVIDED",
    highPriorityUniverse: "NOT PROVIDED",
    salesNorm: "Unknown. Owner-led sales is the default assumption for this size until proven otherwise.",
    growthLevers: ["Map customers", "Map capacity", "Then hire sales only if demand is unconstrained"],
    extraRevenue: [],
    onboarding: "NOT PROVIDED",
    typicalSalesCycle: "NOT PROVIDED",
    typicalProspects: [],
  },
  {
    key: "carwash",
    label: "Express conveyor car wash",
    needed:
      "Drivers buy a fast exterior wash to remove dirt, salt, pollen, and road film; subscription members pay monthly for convenience and vehicle appearance.",
    wantToOwn10Years: true,
    discretionary: "mixed",
    obsolescence:
      "The service is locally delivered and cannot be imported. Demand is durable, but an individual site can be overbuilt.",
    disruption:
      "AI does not replace the wash. Better equipment, license-plate recognition, pricing software, and water-reclamation systems can improve operations.",
    regulatory:
      "Water discharge, reclaim systems, chemical handling, zoning, traffic access, and local permits are material.",
    economicSensitivity:
      "Single washes are discretionary; unlimited-wash memberships can improve recurrence but churn in recessions.",
    usMarketSize: {
      value: "NOT AVAILABLE WITHOUT CURRENT PUBLIC RESEARCH",
      kind: "ESTIMATE",
      note: "Use current International Carwash Association, Census, and sourced market research.",
    },
    cagr: {
      value: "NOT AVAILABLE WITHOUT CURRENT PUBLIC RESEARCH",
      kind: "ESTIMATE",
      note: "Do not reuse an undated market CAGR.",
    },
    fragmentation:
      "Historically fragmented with active regional and private-equity consolidation; local site density matters more than national TAM.",
    competitorsNational:
      "NOT AVAILABLE — fetch a current establishment/operator count.",
    competitorsRegional:
      "Map every tunnel, in-bay automatic, and self-serve site in the practical drive-time trade area.",
    sameSizeCount:
      "Private site-level revenue is generally not public; use traffic, memberships, wash counts, and local comps.",
    largeCompetitors:
      "Large multi-site express operators exist, but current scale must be verified from public sources.",
    icp:
      "Consumers and fleet accounts within a short drive-time radius, especially commuters who value speed and recurring unlimited-wash access.",
    customerUniverse:
      "Vehicles passing or living in the site's trade area — not all U.S. drivers.",
    icpUniverse:
      "Households, commuters, and fleets within the local drive-time trade area.",
    highPriorityUniverse:
      "Frequent local washers and nearby fleet operators; size requires traffic and demographic data.",
    salesNorm:
      "Membership conversion at the pay station, local digital marketing, fleet outreach, and retention are the core commercial motions.",
    growthLevers: [
      "Improve membership conversion and retention",
      "Optimize pricing and package mix",
      "Increase throughput without degrading wash quality",
      "Add fleet accounts only where access and capacity support them",
    ],
    extraRevenue: [
      "Unlimited-wash memberships",
      "Fleet plans",
      "Premium wash packages",
      "Vending and mat-cleaning",
      "Additional sites after unit economics are proven",
    ],
    onboarding:
      "Drive-up or digital lead → package or membership selection → payment / plate enrollment → wash → recurring monthly billing for members.",
    typicalSalesCycle:
      "Immediate for retail consumers; days to weeks for small fleets.",
    typicalProspects: [],
  },
  {
    key: "cstore",
    label: "Gas station / convenience store",
    needed:
      "Customers buy fuel, food, beverages, tobacco/nicotine products, lottery, and convenience items at accessible locations.",
    wantToOwn10Years: true,
    discretionary: "mixed",
    obsolescence:
      "Fuel mix will change over time, but strong convenience retail sites can adapt. Weak fuel-only sites face higher EV-transition risk.",
    disruption:
      "Payments, loyalty, delivery, and EV charging change the offer; they do not eliminate location-based convenience retail.",
    regulatory:
      "Underground storage tanks, fuel/environmental compliance, alcohol/tobacco licensing, food safety, lottery, zoning, and card security are critical.",
    economicSensitivity:
      "Fuel gallons can vary with travel and price; inside-store convenience demand is relatively resilient but margin mix changes.",
    usMarketSize: {
      value: "NOT AVAILABLE WITHOUT CURRENT PUBLIC RESEARCH",
      kind: "ESTIMATE",
      note: "Use current NACS and Census sources; separate fuel sales from inside sales.",
    },
    cagr: {
      value: "NOT AVAILABLE WITHOUT CURRENT PUBLIC RESEARCH",
      kind: "ESTIMATE",
      note: "Separate gallons, fuel margin, inside sales, and foodservice.",
    },
    fragmentation:
      "Large chains coexist with many independents; site quality, traffic, fuel contracts, and inside margin matter more than broad TAM.",
    competitorsNational:
      "NOT AVAILABLE — fetch the current NACS store count.",
    competitorsRegional:
      "Map branded and independent sites in the local traffic corridor.",
    sameSizeCount:
      "Private site economics are rarely public; benchmark gallons, inside sales, gross margin, labor, and rent/site value.",
    largeCompetitors:
      "National and regional chains are relevant, but current revenue and store counts require sourced data.",
    icp:
      "Local drivers, commuters, commercial fleets, and nearby residents choosing the site for access, speed, fuel, food, and convenience.",
    customerUniverse:
      "Traffic in the site's corridor, not the full U.S. consumer market.",
    icpUniverse:
      "Drivers and residents within the site's trade area plus contracted fleets.",
    highPriorityUniverse:
      "Frequent commuters, nearby employers/fleets, and customers responsive to loyalty and foodservice.",
    salesNorm:
      "Location and merchandising drive demand; loyalty, fuel pricing, foodservice, and fleet cards professionalize it.",
    growthLevers: [
      "Improve inside-store mix and gross margin",
      "Add credible foodservice",
      "Use loyalty/fleet programs",
      "Optimize labor, hours, and fuel pricing",
    ],
    extraRevenue: [
      "Prepared food",
      "Fleet cards",
      "Loyalty/subscription offers",
      "ATM/lottery/package services",
      "EV charging where power and dwell time support it",
    ],
    onboarding:
      "Drive-by/local awareness → visit → fuel or store purchase → optional loyalty/fleet enrollment → repeat visits.",
    typicalSalesCycle:
      "Immediate for consumers; weeks to months for fleet relationships.",
    typicalProspects: [],
  },
  {
    key: "assetop",
    label: "Equipment- or real-estate-heavy operator",
    needed:
      "The underlying service may be durable, but the exact customer need is NOT AVAILABLE until the industry and revenue model are identified.",
    wantToOwn10Years: false,
    discretionary: "mixed",
    obsolescence:
      "Asset ownership is not a moat by itself. Technology, location, maintenance, and replacement cycles must be evaluated.",
    disruption:
      "NOT AVAILABLE — depends on the operating service.",
    regulatory:
      "Real estate, environmental, zoning, safety, permits, and equipment compliance may be material.",
    economicSensitivity:
      "High fixed costs can magnify revenue declines.",
    usMarketSize: {
      value: "NOT AVAILABLE — define the operating industry first",
      kind: "ESTIMATE",
      note: "Do not use asset value as a proxy for market demand.",
    },
    cagr: {
      value: "NOT AVAILABLE — define the operating industry first",
      kind: "ESTIMATE",
      note: "Run cited research once the business category is known.",
    },
    fragmentation: "NOT AVAILABLE — depends on the operating industry.",
    competitorsNational: "NOT AVAILABLE",
    competitorsRegional: "NOT AVAILABLE",
    sameSizeCount: "NOT AVAILABLE",
    largeCompetitors: "NOT AVAILABLE",
    icp: "NOT AVAILABLE — identify who pays and why.",
    customerUniverse: "NOT AVAILABLE",
    icpUniverse: "NOT AVAILABLE",
    highPriorityUniverse: "NOT AVAILABLE",
    salesNorm: "NOT AVAILABLE",
    growthLevers: [
      "Verify demand before adding assets",
      "Measure utilization without assuming it",
      "Separate maintenance capex from growth capex",
    ],
    extraRevenue: [],
    onboarding: "NOT AVAILABLE",
    typicalSalesCycle: "NOT AVAILABLE",
    typicalProspects: [],
  },
];

export function matchIndustry(industry: string, name = "", notes = ""): IndustryProfile {
  const blob = `${industry} ${name} ${notes}`.toLowerCase();
  if (/(mold|plastic|injection|resin)/.test(blob)) return PROFILES[0];
  if (/(cnc|machine shop|machining|tool & die|tool and die|precision)/.test(blob)) return PROFILES[1];
  if (/(hvac|mechanical contractor|heating|air condition)/.test(blob)) return PROFILES[2];
  if (
    /(express car wash|carwash|car wash|car washing|conveyor wash|tunnel wash)/.test(
      blob
    )
  )
    return PROFILES[4];
  if (
    /(gas station|service station|c-store|cstore|convenience store|convenience retail|fuel retail)/.test(
      blob
    )
  )
    return PROFILES[5];
  if (/(powder coat|coating|finishing)/.test(blob)) {
    return { ...PROFILES[1], key: "coat", label: "Industrial coatings / finishing", needed: "Manufacturers need durable finishes on metal parts. This is a production service, not a luxury." };
  }
  if (/(sign|neon|print shop)/.test(blob)) {
    return {
      ...PROFILES[3],
      key: "sign",
      label: "Signage",
      needed: "Businesses still buy signs, but digital ads and chains with national vendors pressure independents.",
      wantToOwn10Years: false,
      discretionary: "discretionary",
      obsolescence: "Traditional neon and generic sign shops face long-term demand risk.",
    };
  }
  if (
    /(equipment rental|self storage|warehouse operator|real estate heavy|asset heavy)/.test(
      blob
    )
  ) {
    return PROFILES[6];
  }
  return { ...PROFILES[3], label: industry || PROFILES[3].label };
}
