import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { classifyDocument, extractDocument } from "./document-extraction";
import {
  isSafeCitationUrl,
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
  ensureDealClassification,
  operatingStyleFor,
} from "./classification";
import { companyHighlights } from "./deal-brief";
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
    ["Uniquecoat Technologies", "Industrial technology / thermal spray systems", "Painting / coatings", "Hands-on"],
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

  it("backfills category and operating-style tags without replacing a deal", () => {
    const deal = baseDeal();
    deal.name = "East Texas portfolio";
    deal.industry = "Gas stations / C-stores";
    expect(ensureDealClassification(deal)).toBe(true);
    expect(deal.businessCategory).toBe("Gas / C-store");
    expect(deal.operatingStyleTags).toEqual(["Hands-off"]);
    expect(deal.id).toBe("finish");
    expect(ensureDealClassification(deal)).toBe(false);
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
