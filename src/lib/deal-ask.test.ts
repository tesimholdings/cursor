import { describe, expect, it } from "vitest";
import {
  answerDealQuestion,
  buildDealAskPacket,
  printedConcentrationPercents,
  searchDealPacket,
  unreadDealDocuments,
} from "./deal-ask";
import type { Deal, DocumentRecord } from "./types";

function deal(partial: Partial<Deal> & Pick<Deal, "id" | "name">): Deal {
  return {
    batchId: "batch_ask",
    industry: "Industrial coatings",
    location: "Richmond, VA",
    askingPrice: 4_950_000,
    revenue: 3_200_000,
    sde: 890_000,
    ebitda: 740_000,
    employees: 18,
    realEstateIncluded: null,
    sellerFinancing: null,
    status: "screened",
    researchStatus: "complete",
    createdAt: "",
    updatedAt: "",
    documents: [],
    assignedQuestions: [],
    fatalRisks: [],
    ...partial,
  };
}

describe("deal-scoped packet", () => {
  it("never includes another company's numbers or name", () => {
    const uniquecoat = deal({
      id: "deal_uniquecoat",
      name: "Uniquecoat Technologies",
      notes: "Adjusted SDE is seller-provided. Real estate is owned separately.",
    });
    const mighty = deal({
      id: "deal_mighty",
      name: "Mighty Molding",
      askingPrice: 7_250_000,
      revenue: 4_190_000,
      sde: 1_120_000,
      location: "Toledo, OH",
      notes: "Custom molder. UTC complaint mentioned in broker chat.",
    });

    const packet = buildDealAskPacket(uniquecoat);
    expect(packet.dealId).toBe("deal_uniquecoat");
    expect(packet.text).toContain("Uniquecoat Technologies");
    expect(packet.text).toContain("$4.95M");
    expect(packet.text).not.toContain(mighty.name);
    expect(packet.text).not.toContain("$7.25M");
    expect(packet.text).not.toContain("$4.19M");
    expect(packet.text).not.toContain("$1.12M");
    expect(packet.text).not.toContain("Toledo");
    expect(packet.text).not.toMatch(/UTC complaint/);
  });

  it("lists unread documents without dropping the rest of the packet", () => {
    const scanned: DocumentRecord = {
      id: "doc_scan",
      dealId: "deal_uniquecoat",
      name: "Uniquecoat-CIM.pdf",
      category: "cim",
      stage: 2,
      uploadedAt: "",
      size: 12,
      extraction: {
        status: "failed",
        extractedAt: "",
        error: "PDF contained no extractable text. It may be scanned.",
        chunks: [],
      },
    };
    const card = deal({
      id: "deal_uniquecoat",
      name: "Uniquecoat Technologies",
      notes: "Thermal spray systems.",
      documents: [scanned],
    });
    expect(unreadDealDocuments(card)).toEqual([
      {
        name: "Uniquecoat-CIM.pdf",
        error: "PDF contained no extractable text. It may be scanned.",
      },
    ]);
    const packet = buildDealAskPacket(card);
    expect(packet.text).toContain("Thermal spray systems");
    expect(packet.unreadDocuments).toHaveLength(1);
  });
});

describe("packet text search", () => {
  it("finds phrases inside documents and notes, not just exact fields", () => {
    const card = deal({
      id: "deal_prieto",
      name: "Prieto Construction",
      location: "Prince George's County, MD",
      notes: "UTC complaint on file. Bonding is current through FY26.",
      documents: [
        {
          id: "doc_cim",
          dealId: "deal_prieto",
          name: "Prieto-CIM.pdf",
          category: "cim",
          stage: 2,
          uploadedAt: "",
          size: 80,
          extraction: {
            status: "complete",
            extractedAt: "",
            chunks: [
              {
                text: "Shop attic uses a radiant barrier under the metal roof.",
                page: 14,
              },
            ],
          },
        },
      ],
    });

    const radiant = searchDealPacket(card, "radiant barrier");
    expect(radiant[0]?.excerpt).toMatch(/radiant barrier/i);
    expect(radiant[0]?.title).toBe("Prieto-CIM.pdf");
    expect(radiant[0]?.locator).toMatch(/page 14/);

    const utc = searchDealPacket(card, "UTC");
    expect(utc.some((hit) => /UTC complaint/i.test(hit.excerpt))).toBe(true);

    const county = searchDealPacket(card, "Prince George's");
    expect(county.some((hit) => /Prince George/i.test(hit.excerpt))).toBe(true);
  });
});

describe("grounded answers", () => {
  it("answers real-estate and SDE questions from this packet only", async () => {
    const uniquecoat = deal({
      id: "deal_uniquecoat",
      name: "Uniquecoat Technologies",
      notes:
        "Adjusted SDE is seller-provided. Real estate is owned separately and available for acquisition.",
      realEstateIncluded: null,
    });

    const re = await answerDealQuestion(
      uniquecoat,
      "who owns the real estate?"
    );
    expect(re.dealId).toBe("deal_uniquecoat");
    expect(re.answer).toMatch(/owned separately/i);
    expect(re.answer).toMatch(/Seller Claim/);
    expect(re.answer).not.toMatch(/Mighty|Prieto|\$7\.25M/);
    expect(re.claims.some((claim) => claim.label === "Seller Claim")).toBe(true);

    const sde = await answerDealQuestion(
      uniquecoat,
      "is the SDE tax-tied?"
    );
    expect(sde.answer).toMatch(/Recast|Seller Claim|Unanswered/);
    expect(sde.answer).toMatch(/\$890,000|\$0\.89M|\$890/);
    expect(sde.claims.some((claim) => claim.label === "Seller Claim")).toBe(
      true
    );
    expect(sde.mode).toBe("packet");
  });

  it("describes what the company does from notes and docs", async () => {
    const mighty = deal({
      id: "deal_mighty",
      name: "Mighty Molding",
      industry: "Custom injection molding",
      location: "Toledo, OH",
      notes: "Custom molder serving industrial and automotive accounts.",
      documents: [
        {
          id: "doc_teaser",
          dealId: "deal_mighty",
          name: "Mighty-teaser.pdf",
          category: "listing",
          stage: 1,
          uploadedAt: "",
          size: 40,
          textExcerpt:
            "28 presses on site. Owner ready to retire. Automotive overflow work.",
        },
      ],
    });
    const result = await answerDealQuestion(
      mighty,
      "what does this company actually do?"
    );
    expect(result.answer).toMatch(/injection molding/i);
    expect(result.answer).toMatch(/industrial and automotive/i);
    expect(result.citations.some((cite) => /Mighty|Deal|notes/i.test(cite.title))).toBe(
      true
    );
  });

  it("returns Unanswered for concentration unless a percent is printed", async () => {
    expect(printedConcentrationPercents("top customer is large")).toEqual([]);
    expect(
      printedConcentrationPercents("Largest customer 38% of sales")
    ).toEqual(["38%"]);

    const blank = await answerDealQuestion(
      deal({ id: "deal_prieto", name: "Prieto Construction" }),
      "what is customer concentration?"
    );
    expect(blank.answer).toMatch(/Unanswered/);
    expect(blank.answer).not.toMatch(/\d+(?:\.\d+)?%/);
    expect(blank.claims.every((claim) => claim.label === "Unanswered")).toBe(
      true
    );

    const printed = await answerDealQuestion(
      deal({
        id: "deal_prieto",
        name: "Prieto Construction",
        documents: [
          {
            id: "doc_cust",
            dealId: "deal_prieto",
            name: "customers.xlsx",
            category: "customers",
            stage: 3,
            uploadedAt: "",
            size: 20,
            extraction: {
              status: "complete",
              extractedAt: "",
              chunks: [
                {
                  text: "Largest customer 22% of sales per seller workbook.",
                  sheet: "Customers",
                  cell: "B4",
                },
              ],
            },
          },
        ],
      }),
      "what is customer concentration?"
    );
    expect(printed.answer).toMatch(/22%/);
    expect(printed.answer).toMatch(/Seller Claim/);
  });

  it("does not guess bonding or UTC details that are not in the packet", async () => {
    const result = await answerDealQuestion(
      deal({
        id: "deal_prieto",
        name: "Prieto Construction",
        notes: "Commercial painting in the Mid-Atlantic.",
      }),
      "is there a UTC complaint and is bonding current?"
    );
    expect(result.answer).toMatch(/Unanswered/);
    expect(result.answer).not.toMatch(/\b(yes|no), bonding is\b/i);
  });
});
