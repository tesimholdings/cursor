import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { classifyDocument, extractDocument } from "./document-extraction";
import {
  isSafeCitationUrl,
  researchCompany,
  validatedResearchSources,
} from "./public-research";
import { runDiligence } from "./diligence";
import { computeTax } from "./finance";
import { analyzePacket } from "./packet";
import { parseSpreadsheet } from "./parse-spreadsheet";
import { matchIndustry } from "./industry";
import { numericClaimsSupported } from "./ai";
import {
  brokerCall,
  canRunFullIc,
  dealFunnelStep,
  FUNNEL_STEPS,
} from "./pipeline";
import { parsePastedListing } from "./intake";
import { blobConfiguration, normalizeEtag } from "./blob-store";
import {
  categorizeDeal,
  dealMatchesSearch,
  ensureDealClassification,
  operatingStyleFor,
} from "./classification";
import { companyHighlights } from "./deal-brief";
import { buildOwnerQuestions } from "./owner-questions";
import { buildStage1 } from "./screening";
import {
  boardScoreValue,
  buildBoardScores,
  ensureDealBoardScores,
  equalWeightAverage,
  headlineRankValue,
  headlineScore,
  icHeadlineScore,
  purchaseValueAverage,
  sortDealsByHeadline,
  weightedScore,
} from "./board-scoring";
import { closeSpeedFor, closeSpeedResult } from "./close-speed";
import type {
  Deal,
  DocumentRecord,
  FinalDecision,
  PublicResearch,
} from "./types";

describe("document extraction", () => {
  it("extracts PDF text with a page citation", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText("Revenue $4,190,000 seller provided", {
      x: 50,
      y: 700,
      size: 12,
      font,
    });
    const bytes = await pdf.save();
    const result = await extractDocument(
      "packet.pdf",
      Buffer.from(bytes),
      "application/pdf"
    );

    expect(result.status).toBe("complete");
    expect(result.chunks[0]?.text).toMatch(/Revenue.*4,190,000/);
    expect(result.chunks[0]?.page).toBe(1);
  });

  it("extracts XLSX rows with sheet and cell citations", async () => {
    const bytes = await workbookBuffer("Customers", [
      ["Customer", "Revenue"],
      ["Alpha", 730_000],
      ["Beta", 270_000],
    ]);
    const result = await extractDocument(
      "customer-revenue.xlsx",
      Buffer.from(bytes),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    expect(result.status).toBe("complete");
    expect(result.chunks[0]).toMatchObject({
      sheet: "Customers",
      cell: "A2:B2",
    });
    expect(result.chunks[0]?.text).toContain("Alpha");
    expect(result.tables?.[0]?.rows[0]?.cells.Revenue).toBe("B2");
    expect(classifyDocument("upload.xlsx", result)).toBe("customers");
  });

  it("imports an XLSX business list with listing and company URLs", async () => {
    const bytes = await workbookBuffer("Deals", [
      ["Company Name", "Listing URL", "Company Website", "Revenue"],
      [
        "Test Operator",
        "https://example.com/listing",
        "https://example.com",
        5_000_000,
      ],
    ]);
    const rows = await parseSpreadsheet(
      Buffer.from(bytes),
      "business-list.xlsx"
    );
    expect(rows[0]).toMatchObject({
      name: "Test Operator",
      listingUrl: "https://example.com/listing",
      websiteUrl: "https://example.com",
      revenue: 5_000_000,
    });
  });

  it("finds a titled company table on a later workbook sheet", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Cover").addRows([
      ["Austin Thorpe confidential listing book"],
      ["Prepared for review"],
    ]);
    workbook.addWorksheet("Company Analysis").addRows([
      ["Company Name", "Metric", "Value"],
      ["Supporting Company LLC", "Inventory", 900_000],
    ]);
    workbook.addWorksheet("Listings").addRows([
      ["Company", "Confidential listing book"],
      ["Seller-provided; subject to diligence"],
      [],
      [
        "Company / Name",
        "Asking Price",
        "Revenue",
        "SDE",
        "EBITDA",
        "Projected Revenue",
      ],
      ["Alpha Services", 5_100_000, 4_000_000, 900_000, "", 8_000_000],
      ["Bravo Markets", 6_200_000, 5_000_000, "", 700_000, 9_000_000],
      ["Charlie Supply", "", "", "", "", 10_000_000],
      ["Delta Works", "", "", "", "", 11_000_000],
      ["Echo Industrial", "", "", "", "", 12_000_000],
      ["Foxtrot Retail", "", "", "", "", 13_000_000],
    ]);
    const bytes = await workbook.xlsx.writeBuffer();

    const rows = await parseSpreadsheet(
      Buffer.from(bytes),
      "broker-scorecard.xlsm"
    );

    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.name)).toEqual([
      "Alpha Services",
      "Bravo Markets",
      "Charlie Supply",
      "Delta Works",
      "Echo Industrial",
      "Foxtrot Retail",
    ]);
    expect(rows).not.toContainEqual(
      expect.objectContaining({ name: "Supporting Company LLC" })
    );
    expect(rows[0]).toMatchObject({
      askingPrice: 5_100_000,
      revenue: 4_000_000,
      sde: 900_000,
      ebitda: null,
    });
    expect(rows[1]).toMatchObject({
      askingPrice: 6_200_000,
      revenue: 5_000_000,
      sde: null,
      ebitda: 700_000,
    });
    // "Projected Revenue" is intentionally not a mapped seller-claim column.
    expect(rows[2]?.revenue).toBeNull();
  });

  it("requires an explicit name column after title rows", async () => {
    const bytes = await workbookBuffer("Analysis", [
      ["Named Company LLC"],
      ["Revenue", 5_000_000],
      ["SDE", 1_000_000],
    ]);
    const rows = await parseSpreadsheet(
      Buffer.from(bytes),
      "single-company-analysis.xlsx"
    );
    expect(rows).toEqual([]);
  });

  it("returns a hard failure for an unreadable PDF", async () => {
    const result = await extractDocument(
      "broken.pdf",
      Buffer.from("not a pdf"),
      "application/pdf"
    );
    expect(result.status).toBe("failed");
    expect(result.error).toBeTruthy();
    expect(result.chunks).toHaveLength(0);
  });

  it("carries workbook sheet/cell evidence into packet review", async () => {
    const bytes = await workbookBuffer("P&L", [
      ["Metric", "Amount"],
      ["Revenue", 4_190_000],
      ["SDE", 1_100_000],
    ]);
    const deal = baseDeal();
    const document: DocumentRecord = {
      id: "financial_doc",
      dealId: deal.id,
      name: "seller-financials.xlsx",
      category: "financials",
      stage: 2,
      uploadedAt: new Date().toISOString(),
      size: bytes.byteLength,
      extraction: await extractDocument(
        "seller-financials.xlsx",
        Buffer.from(bytes)
      ),
    };
    expect(classifyDocument("upload.xlsx", document.extraction)).toBe(
      "financials"
    );
    const packet = analyzePacket(deal, "", [document]);
    const revenue = packet.evidence.find((item) => item.label === "Revenue");
    expect(revenue).toMatchObject({
      source: "seller-financials.xlsx",
      sheet: "P&L",
      cell: "A2:B2",
      kind: "SELLER_PROVIDED",
    });
  });
});

describe("research citation safety", () => {
  it("never accepts model-invented URLs or source IDs", () => {
    const research: PublicResearch = {
      status: "complete",
      provider: "tavily",
      searchedAt: new Date().toISOString(),
      sources: [
        {
          id: "src_real",
          title: "Real result",
          url: "https://example.com/source",
          excerpt: "Public excerpt",
          accessedAt: new Date().toISOString(),
          kind: "PUBLIC_SOURCE",
        },
      ],
    };
    expect(
      validatedResearchSources(
        ["src_real", "src_invented", "https://fake.example"],
        research
      )
    ).toEqual([research.sources[0]]);
    expect(isSafeCitationUrl("http://127.0.0.1/private")).toBe(false);
    expect(isSafeCitationUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeCitationUrl("http://[::ffff:127.0.0.1]/secret")).toBe(false);
    expect(isSafeCitationUrl("http://100.64.0.1/metadata")).toBe(false);
  });

  it("rejects model numeric claims absent from cited text", () => {
    expect(
      numericClaimsSupported(
        "Market size is $8.2 billion and CAGR is 6%",
        "The cited source says market size is $8.2 billion."
      )
    ).toBe(false);
    expect(
      numericClaimsSupported(
        "Market size is $8.2 billion",
        "The cited source says market size is $8.2 billion."
      )
    ).toBe(true);
  });
});

describe("TESIM live-lane coverage", () => {
  it.each([
    ["plastic injection molding", "mold"],
    ["express car wash", "carwash"],
    ["gas station and convenience store", "cstore"],
    ["equipment rental asset-heavy operator", "assetop"],
  ])("maps %s to a conservative profile", (industry, expectedKey) => {
    const profile = matchIndustry(industry);
    expect(profile.key).toBe(expectedKey);
    if (expectedKey !== "mold") {
      expect(profile.usMarketSize.value).toMatch(/NOT AVAILABLE/);
    }
  });
});

describe("Stefan product-lock funnel", () => {
  it("uses the five locked funnel labels", () => {
    expect(FUNNEL_STEPS.map((step) => step.label)).toEqual([
      "1. Listing / teaser screen (pre-NDA)",
      "2. NDA + CIM",
      "3. Financials / QoE packet",
      "4. Full IC",
      "5. LOI / price / structure",
    ]);
  });

  it("preserves the broker call and blocks Full IC from teaser SDE", () => {
    const deal = baseDeal();
    deal.status = "screened";
    deal.screening = {
      researchedAt: new Date().toISOString(),
      researchMode: "listing_and_industry",
      questions: [],
      icp: "Unanswered",
      prospects: [],
      valuationLabel: "Reasonable",
      taxAttractiveness: "Low",
      industryQuality: 70,
      growthScore: 60,
      assetsScore: 40,
      preNdaScore: 74,
      decision: "REQUEST_NDA",
      decisionWhy: "First screen only",
      whatWeKnow: "Listing claims",
      whatWeDont: "Financial proof",
      whyItMatters: "Broker call",
      whatNext: "Inquire",
    };
    expect(brokerCall(deal)).toBe("INQUIRE + NDA");
    expect(dealFunnelStep(deal)).toBe(1);
    expect(canRunFullIc(deal)).toBe(false);
  });

  it("unlocks Step 3 from readable financials and Step 4 only after IC", async () => {
    const deal = baseDeal();
    deal.status = "packet_review";
    deal.screening = {
      researchedAt: new Date().toISOString(),
      researchMode: "listing_and_industry",
      questions: [],
      icp: "Unanswered",
      prospects: [],
      valuationLabel: "Reasonable",
      taxAttractiveness: "Low",
      industryQuality: 70,
      growthScore: 60,
      assetsScore: 40,
      preNdaScore: 74,
      decision: "REQUEST_NDA",
      decisionWhy: "Original screen",
      whatWeKnow: "Listing claims",
      whatWeDont: "Financial proof",
      whyItMatters: "Broker call",
      whatNext: "Inquire",
    };
    const bytes = await workbookBuffer("P&L", [
      ["Metric", "Amount"],
      ["Revenue", 4_000_000],
    ]);
    deal.documents.push({
      id: "financials",
      dealId: deal.id,
      name: "financials.xlsx",
      category: "financials",
      stage: 3,
      uploadedAt: new Date().toISOString(),
      size: bytes.byteLength,
      extraction: await extractDocument("financials.xlsx", Buffer.from(bytes)),
    });
    expect(canRunFullIc(deal)).toBe(true);
    expect(dealFunnelStep(deal)).toBe(3);
    deal.diligence = runDiligence(deal);
    expect(dealFunnelStep(deal)).toBe(4);
    deal.status = "loi";
    expect(dealFunnelStep(deal)).toBe(5);
    expect(deal.screening.preNdaScore).toBe(74);
  });

  it("parses pasted broker intel without inventing missing fields", () => {
    const parsed = parsePastedListing(`Company: Fast Wash LLC
Industry: Express car wash
Location: Columbus, OH
Asking price: $7.5M
Revenue: $4.0M
SDE: $1.1M`);
    expect(parsed).toMatchObject({
      name: "Fast Wash LLC",
      industry: "Express car wash",
      location: "Columbus, OH",
      askingPrice: 7_500_000,
      revenue: 4_000_000,
      sde: 1_100_000,
      ebitda: null,
    });
  });
});

describe("shared persistence configuration", () => {
  it("treats a store id on Vercel as configured, because the OIDC token arrives per request", () => {
    expect(
      blobConfiguration({ VERCEL: "1", BLOB_STORE_ID: "store_abc" })
    ).toMatchObject({
      configured: true,
      source: "vercel-oidc",
      onVercel: true,
      storeId: true,
      oidcTokenInEnv: false,
    });
  });

  it("accepts a pulled OIDC token off Vercel and a read/write token anywhere", () => {
    expect(
      blobConfiguration({
        VERCEL_OIDC_TOKEN: "oidc",
        BLOB_STORE_ID: "store_abc",
      })
    ).toMatchObject({ configured: true, source: "vercel-oidc" });
    expect(
      blobConfiguration({ BLOB_READ_WRITE_TOKEN: "token" })
    ).toMatchObject({
      configured: true,
      source: "read-write-token",
      readWriteToken: true,
    });
  });

  it("reduces an HTTP etag header to the validator ifMatch compares", () => {
    expect(normalizeEtag('"abc123"')).toBe("abc123");
    expect(normalizeEtag('W/"abc123"')).toBe("abc123");
    expect(normalizeEtag("abc123")).toBe("abc123");
    expect(normalizeEtag('  "abc123" ')).toBe("abc123");
    expect(normalizeEtag("")).toBeNull();
    expect(normalizeEtag(null)).toBeNull();
  });

  it("stays unconfigured without a store id or a read/write token", () => {
    expect(blobConfiguration({})).toMatchObject({
      configured: false,
      source: "none",
    });
    expect(blobConfiguration({ VERCEL: "1" })).toMatchObject({
      configured: false,
      source: "none",
    });
    expect(blobConfiguration({ VERCEL_OIDC_TOKEN: "oidc" })).toMatchObject({
      configured: false,
      source: "none",
    });
    expect(blobConfiguration({ BLOB_STORE_ID: "store_abc" })).toMatchObject({
      configured: false,
      source: "none",
    });
  });
});

describe("TESIM business categories and company-specific brief", () => {
  it.each([
    ["East Texas portfolio", "Gas stations / C-stores", "Gas / C-store", "Hands-off"],
    ["ACE Painting", "Commercial painting contractor", "Painting / coatings", "Hands-on"],
    ["Uniquecoat Technologies", "Industrial technology / thermal spray systems", "Industrial equipment / manufacturing other", "Hands-on"],
    ["Mighty Molding", "Plastic injection molding", "Plastic / injection molding", "Hands-on"],
    ["Heartland CNC", "Metal fabrication machine shop", "Metal / fabrication / machine shop", "Hands-on"],
  ] as const)(
    "maps %s (%s) to %s / %s",
    (name, industry, category, operatingStyle) => {
      const fixture = { name, industry, notes: undefined };
      expect(categorizeDeal(fixture)).toBe(category);
      expect(operatingStyleFor(fixture)).toBe(operatingStyle);
    }
  );

  it("does not reuse Good / Bad / Interesting sentences across companies", () => {
    const painting = baseDeal();
    painting.name = "ACE Painting";
    painting.industry = "Commercial painting contractor";
    painting.location = "Austin, TX";
    painting.notes = "Commercial repainting services.";

    const gas = baseDeal();
    gas.name = "North Loop Fuel";
    gas.industry = "Gas station and convenience store";
    gas.location = "Dallas, TX";
    gas.notes = "Fuel and convenience retail.";

    const first = companyHighlights(painting);
    const second = companyHighlights(gas);
    for (const group of ["good", "bad", "interesting"] as const) {
      expect(first[group].length).toBeGreaterThanOrEqual(3);
      expect(first[group].length).toBeLessThanOrEqual(6);
      expect(second[group].length).toBeGreaterThanOrEqual(3);
      expect(second[group].length).toBeLessThanOrEqual(6);
      expect(first[group].filter((item) => second[group].includes(item))).toEqual(
        []
      );
    }
  });

  it("backfills every scan tag without replacing a deal", () => {
    const deal = baseDeal();
    deal.name = "East Texas portfolio";
    deal.industry = "Gas stations / C-stores";
    expect(ensureDealClassification(deal)).toBe(true);
    expect(deal.businessCategory).toBe("Gas / C-store");
    expect(deal.operatingStyleTags).toEqual(["Hands-off"]);
    expect(deal.riskSnapshot).toBe("Safer");
    expect(deal.assetProfile).toBe("Unknown");
    expect(deal.boxFit).toBe("In-box");
    expect(deal.earningsQuality).toBe("Unverified");
    expect(deal.recordTag).toBe("Live");
    expect(deal.closeSpeed).toBe("Slow");
    expect(deal.id).toBe("finish");
    expect(ensureDealClassification(deal)).toBe(false);
  });

  it("searches deal identity and tags case-insensitively with normalized spaces", () => {
    const deal = baseDeal();
    deal.name = "Uniquecoat Technologies, LLC";
    deal.industry = "Industrial technology / thermal spray systems";
    deal.location = "Richmond, VA";
    deal.state = "VA";
    deal.broker = "Example Broker";
    deal.source = "Austin Thorpe workbook";
    ensureDealClassification(deal);

    expect(dealMatchesSearch(deal, "  UNIQUECOAT  ")).toBe(true);
    expect(
      dealMatchesSearch(deal, "industrial   equipment / manufacturing")
    ).toBe(true);
    expect(dealMatchesSearch(deal, "hands-on")).toBe(true);
    expect(dealMatchesSearch(deal, "richmond")).toBe(true);
    expect(dealMatchesSearch(deal, "example broker")).toBe(true);
    expect(dealMatchesSearch(deal, "austin thorpe")).toBe(true);
    expect(dealMatchesSearch(deal, "mixed")).toBe(true);
    expect(dealMatchesSearch(deal, "recast")).toBe(false);
    expect(dealMatchesSearch(deal, "fast close")).toBe(true);
    expect(dealMatchesSearch(deal, "")).toBe(true);
    expect(dealMatchesSearch(deal, "gas")).toBe(false);

    const gas = baseDeal();
    gas.name = "East Texas portfolio";
    gas.industry = "Gas stations / C-stores";
    ensureDealClassification(gas);
    expect(dealMatchesSearch(gas, "gas")).toBe(true);
    expect(dealMatchesSearch(gas, "hands-off")).toBe(true);
    expect(dealMatchesSearch(gas, "safer")).toBe(true);
    expect(dealMatchesSearch(gas, "slow")).toBe(true);
    expect(dealMatchesSearch(gas, "fast close")).toBe(false);
  });

  it("keeps the known live examples distinct and evidence-bounded", () => {
    const uniquecoat = baseDeal();
    uniquecoat.name = "Uniquecoat Technologies, LLC";
    uniquecoat.industry = "Industrial technology / thermal spray systems";
    uniquecoat.askingPrice = 4_950_000;
    uniquecoat.ffe = null;
    uniquecoat.realEstateIncluded = null;
    uniquecoat.notes =
      "Adjusted SDE is seller-provided. Real estate is owned separately and available for acquisition.";
    ensureDealClassification(uniquecoat);
    expect(uniquecoat).toMatchObject({
      businessCategory: "Industrial equipment / manufacturing other",
      operatingStyleTags: ["Hands-on"],
      riskSnapshot: "Mixed",
      assetProfile: "Asset-heavy",
      boxFit: "In-box",
      earningsQuality: "Recast",
      closeSpeed: "Mid",
    });

    const painting = baseDeal();
    painting.name = "SE Painting";
    painting.industry = "Commercial and multifamily painting";
    painting.askingPrice = 17_900_000;
    painting.notes =
      "Adjusted EBITDA is seller-provided. Asset-light model; heavy equipment is rented as needed.";
    ensureDealClassification(painting);
    expect(painting).toMatchObject({
      operatingStyleTags: ["Hands-on"],
      riskSnapshot: "Riskier",
      assetProfile: "Asset-light",
      boxFit: "Too big",
      earningsQuality: "Recast",
      closeSpeed: "Mid",
    });
    expect(dealMatchesSearch(painting, "riskier")).toBe(true);
    expect(dealMatchesSearch(painting, "recast")).toBe(true);

    const gas = baseDeal();
    gas.name = "East Texas portfolio";
    gas.industry = "Gas stations / C-stores";
    gas.askingPrice = 35_000_000;
    gas.ffe = null;
    gas.realEstateIncluded = null;
    gas.notes = undefined;
    ensureDealClassification(gas);
    expect(gas).toMatchObject({
      operatingStyleTags: ["Hands-off"],
      riskSnapshot: "Safer",
      assetProfile: "Unknown",
      boxFit: "Too big",
      earningsQuality: "Unverified",
      closeSpeed: "Slow",
    });

    const mighty = baseDeal();
    mighty.name = "Mighty Molding and Manufacturing";
    mighty.industry = "Plastic injection molding / industrial manufacturing";
    mighty.askingPrice = 7_200_000;
    mighty.ffe = null;
    mighty.realEstateIncluded = null;
    mighty.notes = "Reported seller cash flow; focused diligence required.";
    ensureDealClassification(mighty);
    expect(mighty.riskSnapshot).toBe("Riskier");
    expect(mighty.earningsQuality).toBe("Recast");
    expect(mighty.closeSpeed).toBe("Mid");

    const unknown = baseDeal();
    unknown.name = "Unclassified Opportunity";
    unknown.industry = "Unknown";
    unknown.askingPrice = null;
    unknown.revenue = null;
    unknown.sde = null;
    unknown.ebitda = null;
    unknown.ffe = null;
    unknown.realEstateIncluded = null;
    unknown.notes = undefined;
    ensureDealClassification(unknown);
    expect(unknown.riskSnapshot).toBe("Unknown");
    expect(unknown.assetProfile).toBe("Unknown");
    expect(unknown.boxFit).toBe("Unknown");

    const taxTied = baseDeal();
    taxTied.name = "Tax-Tied Fixture";
    taxTied.notes = "Reported earnings reconcile to the supplied tax returns.";
    ensureDealClassification(taxTied);
    expect(taxTied.earningsQuality).toBe("Tax-tied");
  });

  it("marks seed demos so they never appear Safer", () => {
    const seed = baseDeal();
    seed.batchId = "batch_seed";
    seed.source = "Seed list";
    seed.industry = "Gas station / C-store";
    ensureDealClassification(seed);
    expect(seed.recordTag).toBe("Seed / Demo");
    expect(seed.riskSnapshot).toBe("Unknown");
    expect(seed.closeSpeed).toBe("Slow");
    expect(dealMatchesSearch(seed, "seed / demo")).toBe(true);
    expect(dealMatchesSearch(seed, "slow close")).toBe(true);
  });
});

describe("existing-deal seller material refresh", () => {
  it("makes an attached CIM a citable source for refreshed Q&A", async () => {
    const deal = baseDeal();
    deal.name = "Memo Test Company";
    deal.askingPrice = null;
    deal.revenue = null;
    deal.sde = null;
    deal.status = "packet_review";
    deal.documents.push({
      id: "doc_cim",
      dealId: deal.id,
      name: "Memo_Test_CIM.pdf",
      category: "cim",
      stage: 2,
      uploadedAt: new Date().toISOString(),
      size: 100,
      textExcerpt:
        "Memo Test Company applies protective finishes for industrial customers.",
      extraction: {
        status: "complete",
        extractedAt: new Date().toISOString(),
        chunks: [
          {
            text: "Memo Test Company applies protective finishes for industrial customers.",
            page: 1,
          },
        ],
      },
    });

    const research = await researchCompany(deal);
    expect(research.status).toBe("complete");
    expect(research.sources[0]).toMatchObject({
      id: "seller_doc_cim",
      kind: "SELLER_MATERIAL",
      title: "CIM — Memo_Test_CIM.pdf",
    });
    expect(validatedResearchSources(["seller_doc_cim"], research)).toHaveLength(
      1
    );

    deal.publicResearch = research;
    deal.ownerQuestions = buildOwnerQuestions(deal);
    expect(deal.ownerQuestions.questions[0].answer).toContain(
      "applies protective finishes"
    );
    deal.screening = buildStage1(deal);
    expect(deal.screening.questions[0].answer).toContain(
      "applies protective finishes"
    );
    expect(companyHighlights(deal).interesting.join(" ")).toContain(
      "applies protective finishes"
    );
  });
});

describe("single Board average and six sub-scores", () => {
  it("uses the purchase-value weighted headline, not equal weight", () => {
    const deal = baseDeal();
    ensureDealClassification(deal);
    const scores = buildBoardScores(deal);
    expect(scores.average).toBe(purchaseValueAverage(scores));
    expect(equalWeightAverage(scores)).toBe(
      Math.round(
        (scores.financials.score +
          scores.owner.score +
          scores.growth.score +
          scores.handsOff.score +
          scores.safety.score +
          scores.assets.score) /
          6
      )
    );
    expect(ensureDealBoardScores(deal)).toBe(true);
    expect(ensureDealBoardScores(deal)).toBe(false);
    expect(boardScoreValue(deal, "average")).toBe(scores.average);
  });

  it("renormalizes when a board sub is missing and never invents one", () => {
    expect(
      weightedScore([
        { score: 80, weight: 30 },
        { score: 20, weight: 20 },
        { score: 40, weight: 15 },
        { score: 40, weight: 15 },
        { score: 10, weight: 10 },
        { score: 10, weight: 10 },
      ])
    ).toBe(42);
    expect(
      weightedScore([
        { score: 80, weight: 30 },
        { score: null, weight: 20 },
        { score: 40, weight: 15 },
        { score: 40, weight: 15 },
        { score: 10, weight: 10 },
        { score: 10, weight: 10 },
      ])
    ).toBe(Math.round((80 * 30 + 40 * 15 + 40 * 15 + 10 * 10 + 10 * 10) / 80));
  });

  it("reweights IC pillars and keeps fatal-risk PASS", async () => {
    expect(
      icHeadlineScore({
        financial: 20,
        customer: 15,
        operations: 15,
        growth: 15,
        assets: 10,
        dealStructure: 10,
        tax: 10,
        legal: 5,
        total: 100,
      })
    ).toBe(100);
    expect(
      icHeadlineScore({
        financial: 10,
        customer: 0,
        operations: 15,
        growth: 0,
        assets: 10,
        dealStructure: 10,
        tax: 0,
        legal: 0,
        total: 45,
      })
    ).toBe(
      Math.round(
        0.25 * 50 +
          0.2 * 0 +
          0.15 * 100 +
          0.12 * 100 +
          0.1 * 100 +
          0.08 * 0 +
          0.05 * 0 +
          0.05 * 0
      )
    );

    const deal = baseDeal();
    deal.askingPrice = 4_500_000;
    deal.sde = 1_000_000;
    deal.revenue = 4_000_000;
    deal.documents.push(await customerDocument(deal.id));
    const result = runDiligence(deal);
    expect(result.finalDecision).toBe("PASS");
    expect(result.fatalRisks.join(" ")).toMatch(/73.*no extracted customer contract/i);
    expect(result.scores.total).toBe(icHeadlineScore(result.scores));
  });

  it("ranks Hands-off and Safety in opposite directions for gas and painting", () => {
    const gas = baseDeal();
    gas.name = "Gas Portfolio";
    gas.industry = "Gas stations / C-stores";
    gas.askingPrice = 20_000_000;
    gas.ffe = null;
    gas.realEstateIncluded = null;
    gas.notes = undefined;
    ensureDealClassification(gas);
    const gasScores = buildBoardScores(gas);

    const painting = baseDeal();
    painting.name = "SE Painting";
    painting.industry = "Commercial painting contractor";
    painting.askingPrice = 17_900_000;
    painting.ffe = null;
    painting.realEstateIncluded = null;
    painting.notes =
      "Adjusted EBITDA is seller-provided. Asset-light; equipment is rented.";
    ensureDealClassification(painting);
    const paintingScores = buildBoardScores(painting);

    expect(gasScores.handsOff.score).toBeGreaterThan(
      paintingScores.handsOff.score
    );
    expect(gasScores.safety.score).toBeGreaterThan(
      paintingScores.safety.score
    );
    expect(paintingScores.financials.why).toMatch(/Recast/);
  });

  it("does not score recast or unverified earnings like tax-tied earnings", () => {
    const make = (notes: string | undefined) => {
      const deal = baseDeal();
      deal.name = "Earnings Fixture";
      deal.notes = notes;
      ensureDealClassification(deal);
      return buildBoardScores(deal).financials.score;
    };
    const unverified = make(undefined);
    const recast = make("Adjusted EBITDA includes seller add-backs.");
    const taxTied = make("Reported earnings reconcile to supplied tax returns.");
    expect(taxTied).toBeGreaterThan(recast);
    expect(recast).toBeGreaterThan(unverified);
  });

  it("caps unknown capacity and keeps IC separate from the Board average", () => {
    const deal = baseDeal();
    deal.notes = undefined;
    ensureDealClassification(deal);
    ensureDealBoardScores(deal);
    expect(deal.boardScores?.growth.score).toBeLessThanOrEqual(55);
    expect(deal.boardScores?.growth.unknown).toBe(true);
    expect(headlineScore(deal)).toMatchObject({
      label: "Board score",
      score: deal.boardScores?.average,
    });

    deal.diligence = runDiligence(deal);
    const headline = headlineScore(deal);
    expect(headline.label).toBe("IC score");
    expect(headline.score).toBe(deal.diligence.scores.total);
    expect(headline.boardAverage).toBe(deal.boardScores?.average);
  });
});

describe("broker board headline sort", () => {
  it("uses the card headline and parks unscored deals at the Best/Worst edge", () => {
    const uniquecoat = scoredDeal("Uniquecoat Technologies, LLC", 74);
    const mighty = scoredDeal("Mighty Molding and Manufacturing", 68);
    const pass = scoredDeal("East Texas C-store PASS", 41);
    const unscored = scoredDeal("Pending listing", Number.NaN);

    expect(headlineRankValue(uniquecoat)).toBe(74);
    expect(headlineRankValue(unscored)).toBeNull();

    expect(
      sortDealsByHeadline([pass, unscored, mighty, uniquecoat], "best").map(
        (deal) => deal.name
      )
    ).toEqual([
      "Uniquecoat Technologies, LLC",
      "Mighty Molding and Manufacturing",
      "East Texas C-store PASS",
      "Pending listing",
    ]);

    expect(
      sortDealsByHeadline([uniquecoat, mighty, pass, unscored], "worst").map(
        (deal) => deal.name
      )
    ).toEqual([
      "Pending listing",
      "East Texas C-store PASS",
      "Mighty Molding and Manufacturing",
      "Uniquecoat Technologies, LLC",
    ]);
  });

  it("ranks a Step-2 IC headline ahead of Board average when they disagree", () => {
    const highBoardLowIc = scoredDeal("High board / low IC", 90);
    highBoardLowIc.diligence = runDiligence(highBoardLowIc);
    highBoardLowIc.diligence.scores = icScoresAtPercent(40);

    const lowBoardHighIc = scoredDeal("Low board / high IC", 40);
    lowBoardHighIc.diligence = runDiligence(lowBoardHighIc);
    lowBoardHighIc.diligence.scores = icScoresAtPercent(90);

    expect(headlineScore(highBoardLowIc)).toMatchObject({
      label: "IC score",
      score: icHeadlineScore(highBoardLowIc.diligence.scores),
      boardAverage: 90,
    });
    expect(headlineRankValue(lowBoardHighIc)).toBe(
      icHeadlineScore(lowBoardHighIc.diligence.scores)
    );

    expect(
      sortDealsByHeadline([highBoardLowIc, lowBoardHighIc], "best").map(
        (deal) => deal.name
      )
    ).toEqual(["Low board / high IC", "High board / low IC"]);
  });

  it("does not let a Hands-off gas PASS outrank a real IC just because Hands-off was equal-weight", () => {
    const gas = baseDeal();
    gas.name = "East Texas portfolio";
    gas.industry = "Gas stations / C-stores";
    gas.askingPrice = 20_000_000;
    gas.ffe = null;
    gas.realEstateIncluded = null;
    gas.notes = undefined;
    gas.diligence = undefined;
    ensureDealClassification(gas);
    ensureDealBoardScores(gas);

    const icDeal = scoredDeal("Mighty Molding and Manufacturing", 40);
    icDeal.diligence = runDiligence(icDeal);
    icDeal.diligence.scores = icScoresAtPercent(58);

    const gasEqual = equalWeightAverage(gas.boardScores!);
    const gasWeighted = purchaseValueAverage(gas.boardScores!);
    expect(gasScoresHandsOffBoost(gasEqual, gasWeighted)).toBe(true);
    expect(headlineScore(gas).label).toBe("Board score");
    expect(headlineScore(icDeal).label).toBe("IC score");
    expect(headlineRankValue(icDeal)).toBeGreaterThan(headlineRankValue(gas)!);
    expect(
      sortDealsByHeadline([gas, icDeal], "best").map((deal) => deal.name)
    ).toEqual(["Mighty Molding and Manufacturing", "East Texas portfolio"]);
  });
});

describe("close-speed tags", () => {
  it("tags seeds Slow and never Fast", () => {
    const seed = baseDeal();
    seed.batchId = "batch_seed";
    seed.source = "Seed list";
    seed.name = "Mighty Molding";
    seed.industry = "Custom injection molding";
    seed.realEstateIncluded = false;
    ensureDealClassification(seed);
    expect(closeSpeedFor(seed)).toBe("Slow");
    expect(closeSpeedResult(seed).reasons.join(" ")).toMatch(/Seed/);
  });

  it("tags gas, gov/WBE, franchise, tooling, and person-certs Slow from existing facts", () => {
    const gas = classifiedDeal({
      name: "East Texas portfolio",
      industry: "Gas stations / C-stores",
      askingPrice: 35_000_000,
      realEstateIncluded: true,
    });
    expect(closeSpeedFor(gas)).toBe("Slow");

    const gov = classifiedDeal({
      name: "Harbor Machine LLC",
      industry: "Precision CNC machining",
      notes: "WBE set-aside government contractor; novation required.",
      realEstateIncluded: false,
    });
    expect(closeSpeedFor(gov)).toBe("Slow");

    const franchise = classifiedDeal({
      name: "Quick Lube Express LLC",
      industry: "Oil change / lube",
      notes: "Franchise agreement; franchise transfer required.",
      realEstateIncluded: false,
    });
    expect(closeSpeedFor(franchise)).toBe("Slow");

    const molds = classifiedDeal({
      name: "Precision Plastics LLC",
      industry: "Plastic injection molding",
      notes: "Customer-owned molds stay with the largest account.",
      realEstateIncluded: false,
    });
    expect(closeSpeedFor(molds)).toBe("Slow");

    const personCert = classifiedDeal({
      name: "Gulf Coast Builders LLC",
      industry: "Commercial construction",
      notes: "Personal CGC sits on the founder.",
      realEstateIncluded: false,
    });
    expect(closeSpeedFor(personCert)).toBe("Slow");
  });

  it("tags Fast only for a named clean operator and Mid for a normal recast CIM path", () => {
    const fast = classifiedDeal({
      name: "Heartland Precision CNC LLC",
      industry: "Precision CNC machining",
      askingPrice: 5_400_000,
      realEstateIncluded: false,
      notes: "Job shop. Tax-tied earnings reconcile to supplied tax returns.",
    });
    expect(fast.earningsQuality).toBe("Tax-tied");
    expect(closeSpeedFor(fast)).toBe("Fast");

    const mid = classifiedDeal({
      name: "Uniquecoat Technologies, LLC",
      industry: "Industrial technology / thermal spray systems",
      askingPrice: 4_950_000,
      realEstateIncluded: true,
      notes:
        "Adjusted SDE is seller-provided. Real estate is owned separately and available for acquisition.",
    });
    expect(mid.earningsQuality).toBe("Recast");
    expect(closeSpeedFor(mid)).toBe("Mid");

    const unnamedBroker = classifiedDeal({
      name: "Confidential seller",
      industry: "Distribution / wholesale",
      broker: "Midwest Business Brokers",
      listingUrl: "https://example.com/listing",
      askingPrice: 6_000_000,
      realEstateIncluded: false,
    });
    expect(closeSpeedFor(unnamedBroker)).toBe("Mid");

    const unnamedNoPath = classifiedDeal({
      name: "Unclassified Opportunity",
      industry: "Unknown",
      askingPrice: null,
      realEstateIncluded: null,
    });
    expect(closeSpeedFor(unnamedNoPath)).toBe("Slow");
  });
});

describe("TESIM/AIS IC rules", () => {
  const allowed: FinalDecision[] = [
    "STRONG BUY",
    "BUY SUBJECT TO CONDITIONS",
    "CONTINUE DILIGENCE",
    "RENEGOTIATE",
    "PASS",
  ];

  it("uses exactly one of the five IC calls", () => {
    const result = runDiligence(baseDeal());
    expect(allowed).toContain(result.finalDecision);
  });

  it("passes a 73% customer book without contract evidence", async () => {
    const deal = baseDeal();
    deal.askingPrice = 4_500_000;
    deal.sde = 1_000_000;
    deal.revenue = 4_000_000;
    deal.documents.push(await customerDocument(deal.id));

    const result = runDiligence(deal);
    expect(result.customers[0]?.share).toBeCloseTo(0.73, 4);
    expect(result.fatalRisks.join(" ")).toMatch(/73.*no extracted customer contract/i);
    expect(result.finalDecision).toBe("PASS");
    expect(result.maxPrice.value).toBeNull();
  });

  it("never misreads a GL account/amount table as customer concentration", async () => {
    const bytes = await workbookBuffer("GL", [
      ["Account", "Amount"],
      ["Inventory", 625_000],
      ["Payroll", 375_000],
    ]);
    const deal = baseDeal();
    deal.documents.push({
      id: "gl_doc",
      dealId: deal.id,
      name: "general-ledger.xlsx",
      category: "financials",
      stage: 3,
      uploadedAt: new Date().toISOString(),
      size: bytes.byteLength,
      extraction: await extractDocument(
        "general-ledger.xlsx",
        Buffer.from(bytes)
      ),
    });
    const result = runDiligence(deal);
    expect(result.customers).toHaveLength(0);
    expect(result.concentrationFlag).toBe("UNKNOWN");
    expect(result.fatalRisks.join(" ")).not.toMatch(/customer/i);
  });
});

describe("tax guardrails", () => {
  it("does not assume TESIM income offset or 168(n) treatment for a used factory", () => {
    const tax = computeTax({
      structure: "asset",
      purchasePrice: 7_000_000,
      ffe: 1_500_000,
      realEstate: true,
    });
    expect(tax.year1Deductions).toBeNull();
    expect(tax.canOffsetTesimIncome).toBe("UNVERIFIED");
    expect(tax.eligibilityChecks.section469PassiveActivity).toBe("UNVERIFIED");
    expect(tax.deferralBenefits.join(" ")).toMatch(/used equipment.*168\(k\)/i);
    expect(tax.propertyTreatment.join(" ")).toMatch(
      /used factory building is not Section 168\(n\)/i
    );
  });
});

async function customerDocument(dealId: string): Promise<DocumentRecord> {
  const bytes = await workbookBuffer("Customer Revenue", [
      ["Customer", "Revenue"],
      ["Largest Customer", 2_920_000],
      ["Customer B", 600_000],
      ["Customer C", 480_000],
    ]);
  return {
    id: "customer_doc",
    dealId,
    name: "customer-revenue.xlsx",
    category: "customers",
    stage: 3,
    uploadedAt: new Date().toISOString(),
    size: bytes.byteLength,
    extraction: await extractDocument(
      "customer-revenue.xlsx",
      Buffer.from(bytes)
    ),
  };
}

async function workbookBuffer(sheetName: string, rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet(sheetName).addRows(rows);
  return workbook.xlsx.writeBuffer();
}

function baseDeal(): Deal {
  return {
    id: "finish",
    batchId: "batch",
    name: "Mighty-like Manufacturer",
    industry: "Plastic injection molding",
    location: "Ohio",
    askingPrice: 5_000_000,
    revenue: 4_000_000,
    sde: 1_000_000,
    realEstateIncluded: false,
    sellerFinancing: false,
    status: "diligence",
    researchStatus: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    documents: [],
    assignedQuestions: [],
    fatalRisks: [],
  };
}

function scoredDeal(name: string, average: number): Deal {
  const deal = baseDeal();
  deal.id = name;
  deal.name = name;
  deal.boardScores = { ...buildBoardScores(deal), average };
  return deal;
}

function icScoresAtPercent(percent: number) {
  const p = percent / 100;
  const scores = {
    financial: Math.round(20 * p),
    customer: Math.round(15 * p),
    operations: Math.round(15 * p),
    growth: Math.round(15 * p),
    assets: Math.round(10 * p),
    dealStructure: Math.round(10 * p),
    tax: Math.round(10 * p),
    legal: Math.round(5 * p),
    total: 0,
  };
  scores.total = icHeadlineScore(scores);
  return scores;
}

function classifiedDeal(partial: Partial<Deal> & Pick<Deal, "name" | "industry">) {
  const deal = baseDeal();
  Object.assign(deal, partial);
  ensureDealClassification(deal);
  return deal;
}

function gasScoresHandsOffBoost(equalWeight: number, weighted: number) {
  return equalWeight > weighted;
}
