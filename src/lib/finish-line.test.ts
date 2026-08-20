import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractDocument } from "./document-extraction";
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
