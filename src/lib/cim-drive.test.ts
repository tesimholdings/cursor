import { describe, expect, it } from "vitest";
import {
  attachKnownCimDriveUrl,
  isDumpDocument,
  isOpenableCimDocument,
  knownCimDriveFor,
  normalizeDriveViewUrl,
  openCimUrl,
} from "./cim-drive";
import { applyDealPatch } from "./deal-patch";
import { documentClickUrl, withClickableDocumentUrls } from "./documents";
import { companyScan } from "./company-scan";
import type { Deal, DocumentRecord } from "./types";

function doc(
  partial: Partial<DocumentRecord> & Pick<DocumentRecord, "id" | "name">
): DocumentRecord {
  return {
    dealId: "deal_scan",
    category: "other",
    stage: 1,
    uploadedAt: new Date().toISOString(),
    size: 10,
    ...partial,
  };
}

function deal(partial: Partial<Deal> = {}): Deal {
  return {
    id: "deal_scan",
    batchId: "batch",
    name: "Uniquecoat Technologies, LLC",
    industry: "Thermal spray",
    location: "Oilville, VA",
    askingPrice: 4_950_000,
    revenue: 2_246_787,
    sde: 1_296_396,
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

describe("Open CIM Drive URL", () => {
  it("normalizes Drive share links to /file/d/FILE_ID/view", () => {
    expect(
      normalizeDriveViewUrl(
        "https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view?usp=drivesdk"
      )
    ).toBe("https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view");
  });

  it("opens deal.cimDriveUrl first and PATCH persists it", () => {
    const card = deal({
      documents: [
        doc({
          id: "extract",
          name: "Mighty-Molding-CIM-extract.pdf",
          category: "cim",
          textExcerpt: "C O N F I D E N T I A L beige OCR dump",
        }),
      ],
    });
    applyDealPatch(card, {
      cimDriveUrl:
        "https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view?usp=sharing",
    });
    expect(card.cimDriveUrl).toBe(
      "https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view"
    );
    expect(openCimUrl(card)).toBe(card.cimDriveUrl);
    expect(companyScan(card).openCimUrl).toBe(card.cimDriveUrl);
  });

  it("falls back to a cim document with a real URL and skips dumps", () => {
    const card = deal({
      name: "Lawrence Furniture",
      documents: [
        doc({
          id: "tavily",
          name: "tavily-lawrence.pdf",
          category: "cim",
          url: "https://example.com/tavily-lawrence.pdf",
        }),
        doc({
          id: "ais",
          name: "ais-tight-copy-deal.pdf",
          category: "cim",
          url: "https://example.com/ais-tight-copy-deal.pdf",
        }),
        doc({
          id: "extract",
          name: "Mighty-Molding-CIM-extract.pdf",
          category: "cim",
          url: "https://example.com/Mighty-Molding-CIM-extract.pdf",
        }),
        doc({
          id: "cim",
          name: "Furniture-CIM.pdf",
          category: "cim",
          url: "https://files.example.com/Furniture-CIM.pdf",
        }),
      ],
    });
    expect(isDumpDocument(card.documents[0])).toBe(true);
    expect(isDumpDocument(card.documents[1])).toBe(true);
    expect(isDumpDocument(card.documents[2])).toBe(true);
    expect(isOpenableCimDocument(card.documents[3])).toBe(true);
    expect(openCimUrl(card)).toBe("https://files.example.com/Furniture-CIM.pdf");
    const scan = companyScan(card);
    expect(scan.openCimUrl).toBe("https://files.example.com/Furniture-CIM.pdf");
    expect(scan.dumpDocuments.map((item) => item.name)).toEqual([
      "tavily-lawrence.pdf",
      "ais-tight-copy-deal.pdf",
      "Mighty-Molding-CIM-extract.pdf",
    ]);
    expect(scan.otherDocuments.some((item) => /tavily|ais-tight|extract/i.test(item.name))).toBe(
      false
    );
  });

  it("does not treat extracted-text-only CIMs as Open CIM", () => {
    const card = deal({
      name: "Lawrence Furniture",
      documents: [
        doc({
          id: "cim",
          name: "Old-CIM.pdf",
          category: "cim",
          textExcerpt: "CONFIDENTIALINFORMATIONMEMORANDUM TRAILING 3-YEAR",
        }),
      ],
    });
    expect(openCimUrl(card)).toBeNull();
    expect(documentClickUrl(card.id, card.documents[0], "https://app.example")).toBeUndefined();
    const hydrated = withClickableDocumentUrls(card, "https://app.example");
    expect(hydrated.documents[0].url).toBeUndefined();
  });

  it("maps known Drive CIMs onto Uniquecoat and not onto extract dumps", () => {
    const card = deal({
      documents: [
        doc({ id: "tavily", name: "tavily-uniquecoat.pdf", category: "listing" }),
        doc({
          id: "cim",
          name: "UCT_CIM_6326.pdf",
          category: "cim",
          textExcerpt: "OCR pages",
        }),
      ],
    });
    expect(knownCimDriveFor(card)?.fileId).toBe("1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o");
    expect(attachKnownCimDriveUrl(card)).toBe(true);
    expect(card.cimDriveUrl).toBe(
      "https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view"
    );
    expect(card.documents[1].url).toBe(card.cimDriveUrl);
    expect(openCimUrl(card)).toBe(card.cimDriveUrl);
  });

  it("does not put the Drive CIM URL on an extract.pdf dump", () => {
    const card = deal({
      name: "Mighty Molding and Manufacturing",
      documents: [
        doc({
          id: "extract",
          name: "Mighty-Molding-CIM-extract.pdf",
          category: "cim",
          textExcerpt: "tiny OCR snippet",
        }),
      ],
    });
    attachKnownCimDriveUrl(card);
    expect(card.cimDriveUrl).toBe(
      "https://drive.google.com/file/d/1NS4QkSZqTtJzXMuq4FHZqlVMxJus_Sbd/view"
    );
    expect(card.documents[0].url).toBeUndefined();
    expect(openCimUrl(card)).toBe(card.cimDriveUrl);
  });

  it("returns stored Drive url from GET document metadata helpers", () => {
    const document = doc({
      id: "cim",
      name: "Nusens USA CIM.pdf",
      category: "cim",
      url: "https://drive.google.com/file/d/1VdPz5u_NzD4tGYC_aoNHc91lnsfr_aFQ/view?usp=drivesdk",
    });
    expect(documentClickUrl("deal_scan", document)).toBe(
      "https://drive.google.com/file/d/1VdPz5u_NzD4tGYC_aoNHc91lnsfr_aFQ/view"
    );
  });
});
