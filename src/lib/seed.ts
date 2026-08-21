import type { Deal, Store } from "./types";
import { defaultTeams } from "./teams";
import { buildStage1 } from "./screening";
import { analyzePacket, applyPacketAssignments } from "./packet";
import { buildOwnerQuestions } from "./owner-questions";

function deal(
  partial: Partial<Deal> & Pick<Deal, "id" | "name" | "industry" | "location">
): Deal {
  const now = new Date().toISOString();
  const d: Deal = {
    batchId: "batch_seed",
    askingPrice: null,
    revenue: null,
    ebitda: null,
    sde: null,
    employees: null,
    realEstateIncluded: null,
    ffe: null,
    sellerFinancing: null,
    status: "imported",
    researchStatus: "pending",
    createdAt: now,
    updatedAt: now,
    documents: [],
    assignedQuestions: [],
    fatalRisks: [],
    state: partial.location.match(/\b[A-Z]{2}\b/)?.[0],
    source: "Seed list",
    ...partial,
  };
  return d;
}

export function seedStore(): Store {
  const rows: Deal[] = [
    deal({
      id: "deal_mighty",
      name: "Mighty Molding",
      industry: "Custom injection molding",
      location: "Toledo, OH",
      askingPrice: 7_250_000,
      revenue: 4_190_000,
      sde: 1_120_000,
      ebitda: 980_000,
      employees: 28,
      realEstateIncluded: true,
      ffe: 1_850_000,
      sellerFinancing: true,
      broker: "Midwest Business Brokers",
      notes: "Custom molder serving industrial and automotive accounts. Presses on site. Owner ready to retire.",
      teamId: "team_mighty",
    }),
    deal({
      id: "deal_heartland",
      name: "Heartland Precision CNC",
      industry: "Precision CNC machining",
      location: "Fort Wayne, IN",
      askingPrice: 5_400_000,
      revenue: 3_600_000,
      sde: 890_000,
      employees: 22,
      realEstateIncluded: false,
      ffe: 1_200_000,
      sellerFinancing: false,
      notes: "Job shop with aerospace overflow work. AS9100 mentioned in listing.",
    }),
    deal({
      id: "deal_lakeside",
      name: "Lakeside Commercial HVAC",
      industry: "Commercial HVAC",
      location: "Grand Rapids, MI",
      askingPrice: 6_100_000,
      revenue: 5_800_000,
      sde: 1_050_000,
      employees: 34,
      realEstateIncluded: false,
      sellerFinancing: true,
      notes: "Service-heavy mechanical contractor. Mix of maintenance agreements and projects.",
    }),
    deal({
      id: "deal_summit",
      name: "Summit Powder Coating",
      industry: "Powder coating / finishing",
      location: "Dayton, OH",
      askingPrice: 3_200_000,
      revenue: 2_400_000,
      sde: 620_000,
      employees: 16,
      realEstateIncluded: true,
      ffe: 700_000,
      notes: "Line coating for OEMs. Claims unused line time.",
    }),
    deal({
      id: "deal_oak",
      name: "Oak & Iron Cabinets",
      industry: "Custom cabinetry",
      location: "Nashville, TN",
      askingPrice: 4_800_000,
      revenue: 3_100_000,
      sde: 410_000,
      employees: 19,
      notes: "High-end residential cabinets. Owner is the designer-salesperson.",
    }),
    deal({
      id: "deal_neon",
      name: "Brightline Neon & Signs",
      industry: "Neon sign shop",
      location: "Phoenix, AZ",
      askingPrice: 2_200_000,
      revenue: 1_400_000,
      sde: 280_000,
      employees: 8,
      notes: "Retail signage and some neon restoration. Revenue down vs prior peak per broker comment.",
    }),
    deal({
      id: "deal_prairie",
      name: "Prairie Packaging Co.",
      industry: "Corrugated packaging",
      location: "Des Moines, IA",
      askingPrice: 8_900_000,
      revenue: 9_400_000,
      ebitda: 1_350_000,
      sde: 1_480_000,
      employees: 45,
      realEstateIncluded: true,
      ffe: 2_400_000,
      sellerFinancing: true,
      notes: "Sheet plant serving food and industrial shippers. Equipment-heavy.",
    }),
    deal({
      id: "deal_apex",
      name: "Apex Tool & Die",
      industry: "Tool and die / stamping dies",
      location: "Rockford, IL",
      askingPrice: 5_900_000,
      revenue: 3_200_000,
      sde: 740_000,
      employees: 18,
      ffe: 980_000,
      notes: "Builds dies for stampers. Long-tenured toolmakers.",
    }),
    deal({
      id: "deal_river",
      name: "River City Electrical Contractors",
      industry: "Commercial electrical",
      location: "Louisville, KY",
      askingPrice: 9_750_000,
      revenue: 11_200_000,
      sde: 1_620_000,
      employees: 52,
      sellerFinancing: false,
      notes: "Commercial and light industrial electrical. Union labor. Project-heavy.",
    }),
    deal({
      id: "deal_valley",
      name: "Valley Food Distribution",
      industry: "Specialty food distribution",
      location: "Columbus, OH",
      askingPrice: 6_400_000,
      revenue: 14_000_000,
      sde: 780_000,
      employees: 24,
      notes: "Thin-margin distribution. Refrigerated fleet. Top restaurant chain is a large account.",
    }),
  ];

  for (const d of rows) {
    d.ownerQuestions = buildOwnerQuestions(d);
    d.screening = buildStage1(d);
    d.researchStatus = "complete";
    d.status = d.screening.decision === "PASS" ? "passed" : "screened";
  }

  const mighty = rows.find((d) => d.id === "deal_mighty")!;
  mighty.status = "packet_review";
  mighty.teamId = "team_mighty";
  mighty.documents.push({
    id: "doc_cim_mighty",
    dealId: mighty.id,
    name: "Mighty-Molding-CIM.txt",
    category: "cim",
    stage: 2,
    uploadedAt: new Date().toISOString(),
    size: 1200,
    textExcerpt:
      "Demo CIM placeholder. Customer concentration, contracts, certifications, equipment schedule, utilization, capacity, and verified financials are NOT PROVIDED.",
  });
  mighty.packet = analyzePacket(mighty, mighty.documents[0].textExcerpt || "");
  applyPacketAssignments(mighty);

  const heart = rows.find((d) => d.id === "deal_heartland")!;
  heart.status = "waiting_packet";
  heart.documents.push({
    id: "doc_nda",
    dealId: heart.id,
    name: "NDA-requested",
    category: "other",
    stage: 2,
    uploadedAt: new Date().toISOString(),
    size: 0,
  });

  const lake = rows.find((d) => d.id === "deal_lakeside")!;
  lake.status = "nda_requested";

  return {
    deals: rows,
    teams: defaultTeams(),
    batches: [
      {
        id: "batch_seed",
        name: "Sample lower-middle-market list",
        createdAt: new Date().toISOString(),
        total: rows.length,
      },
    ],
  };
}
