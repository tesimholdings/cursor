import { describe, expect, it } from "vitest";
import { boardCardLines, cashLine } from "./board-card";
import { headlineScore } from "./board-scoring";
import { companyHighlights } from "./deal-brief";
import { money } from "./format";
import type { Deal, DocumentRecord } from "./types";

function deal(partial: Partial<Deal> = {}): Deal {
  return {
    id: "deal_scan",
    batchId: "batch",
    name: "Uniquecoat Technologies, LLC",
    industry: "Thermal spray equipment",
    location: "Oilville, VA",
    askingPrice: 4_950_000,
    revenue: 2_246_787,
    sde: 1_296_396,
    earningsQuality: "Recast",
    realEstateIncluded: false,
    sellerFinancing: false,
    status: "packet_review",
    researchStatus: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    documents: [],
    assignedQuestions: [],
    fatalRisks: [],
    ...partial,
  };
}

function doc(
  partial: Partial<DocumentRecord> & Pick<DocumentRecord, "id" | "name">
): DocumentRecord {
  return {
    dealId: "deal_scan",
    category: "cim",
    stage: 2,
    uploadedAt: new Date().toISOString(),
    size: 10,
    ...partial,
  };
}

describe("board card lines", () => {
  it("keeps four tight lines and labels recast SDE as Seller Claim", () => {
    const card = deal({
      dealPicture: {
        version: 7,
        status: "from_cim",
        summary:
          "They sell HVAF spray systems and powder feeders. Industrial plants pay for the equipment.",
        ugly: "Ugly: founder-inventor key-person, not a plant hall.",
        facts: [],
        risks: [],
        unanswered: [],
        rebuiltAt: new Date().toISOString(),
        scoreLabel: "Board score",
        score: 60,
        closeSpeed: "Mid",
      },
      cimDriveUrl:
        "https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view",
    });
    const lines = boardCardLines(card);
    const headline = headlineScore(card);
    expect(lines.what).toBe(
      "They sell HVAF spray systems and powder feeders."
    );
    expect(lines.cash).toBe(
      "Ask $4.95M · Seller Claim rev $2.25M / SDE $1.30M"
    );
    expect(lines.ugly).toBe(
      "Ugly: Founder-inventor key-person, not a plant hall."
    );
    expect(lines.call).toBe(
      `CONTINUE · ${headline.label} ${headline.score}`
    );
    expect(lines.closeSpeed).toBe("Mid");
    expect(lines.openCimUrl).toBe(
      "https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view"
    );
    expect(`${lines.what} ${lines.cash} ${lines.ugly} ${lines.call}`).not.toMatch(
      /confidential|memorandum|tavily|ais-tight/i
    );
  });

  it("drops CIM cover OCR and does not invent missing cash", () => {
    const lines = boardCardLines(
      deal({
        askingPrice: null,
        revenue: null,
        sde: null,
        ebitda: null,
        earningsQuality: "Unverified",
        dealPicture: {
          version: 7,
          status: "from_cim",
          summary:
            "C O N F I D E N T I A L I N F O R M A T I O N M E M O R A N D U M",
          ugly: "CONFIDENTIALINFORMATIONMEMORANDUM beige blob",
          facts: [
            {
              label: "Ask",
              value: "$6.9M Seller Claim",
              kind: "SELLER_CLAIM",
            },
          ],
          risks: [],
          unanswered: [],
          rebuiltAt: new Date().toISOString(),
          scoreLabel: "Board score",
          score: 40,
          closeSpeed: "Slow",
        },
      })
    );
    expect(lines.what).toBe("Thermal spray equipment");
    expect(lines.cash).toBe(
      "Ask $6.9M · Seller Claim rev not printed / SDE not printed"
    );
    expect(lines.ugly).toBe("Ugly not printed.");
    expect(lines.what + lines.ugly).not.toMatch(/CONFIDENTIAL|MEMORANDUM/i);
    expect(lines.openCimUrl).toBe(
      "https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view"
    );
  });

  it("does not mark tax-tied earnings as Seller Claim", () => {
    expect(
      cashLine(
        deal({
          earningsQuality: "Tax-tied",
          sde: null,
          ebitda: 980_000,
        })
      )
    ).toBe(
      `Ask ${money(4_950_000)} · rev ${money(2_246_787)} / EBITDA ${money(980_000)}`
    );
  });

  it("keeps highlight text off OCR cover pages and tavily dumps", () => {
    const highlights = companyHighlights(
      deal({
        notes: "C O N F I D E N T I A L I N F O R M A T I O N M E M O R A N D U M",
        documents: [
          doc({
            id: "ocr",
            name: "UCT_CIM_6326.pdf",
            textExcerpt:
              "C O N F I D E N T I A L I N F O R M A T I O N M E M O R A N D U M prepared for buyers",
          }),
          doc({
            id: "dump",
            name: "tavily-uniquecoat.pdf",
            category: "listing",
            textExcerpt: "Tavily public screen pasted as a beige blob of research.",
          }),
        ],
      })
    );
    const text = [...highlights.good, ...highlights.bad, ...highlights.interesting].join(
      " "
    );
    expect(text).not.toMatch(/CONFIDENTIAL|INFORMATION MEMORANDUM|Tavily public/i);
  });
});
