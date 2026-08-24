import { describe, expect, it } from "vitest";
import {
  attachKnownCimDriveUrl,
  isDumpDocument,
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

  it("opens publicResearch.cimDriveUrl for live Uniquecoat and lifts a first-class cimDriveUrl", () => {
    const card = deal({
      id: "deal_61peacy76abh",
      name: "Uniquecoat Technologies, LLC",
      documents: [
        doc({
          id: "cim",
          name: "UCT_CIM_6326.pdf",
          category: "cim",
          textExcerpt: "C O N F I D E N T I A L beige OCR dump",
        }),
        doc({ id: "tavily", name: "tavily-uniquecoat.pdf", category: "listing" }),
        doc({
          id: "ais",
          name: "ais-tight-copy-deal_61peacy76abh.pdf",
          category: "listing",
        }),
      ],
      publicResearch: {
        status: "complete",
        provider: "tavily",
        searchedAt: new Date().toISOString(),
        sources: [],
        cimDriveUrl:
          "https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view",
        cimDriveFileId: "1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o",
        cimDriveName: "UCT_CIM_6326.pdf",
        cimDriveFolderUrl:
          "https://drive.google.com/drive/folders/189SZoMdUK3NMgZvava05vSXh7yR_OaB4",
      },
    });
    expect(card.cimDriveUrl).toBeUndefined();
    expect(openCimUrl(card)).toBe(
      "https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view"
    );
    expect(companyScan(card).openCimUrl).toBe(
      "https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view"
    );
    expect(attachKnownCimDriveUrl(card)).toBe(true);
    expect(card.cimDriveUrl).toBe(
      "https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view"
    );
    expect(card.documents[0].url).toBeUndefined();
  });

  it("persists first-class cimDriveUrl on PATCH and mirrors it onto publicResearch", () => {
    const card = deal({
      name: "Lawrence Furniture",
      publicResearch: {
        status: "complete",
        provider: "none",
        searchedAt: new Date().toISOString(),
        sources: [],
      },
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
    expect(card.publicResearch?.cimDriveUrl).toBe(card.cimDriveUrl);
    expect(card.publicResearch?.cimDriveFileId).toBe(
      "1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o"
    );
    expect(openCimUrl(card)).toBe(card.cimDriveUrl);
  });

  it("keeps publicResearch CIM Drive fields when PATCH omits them", () => {
    const card = deal({
      name: "Lawrence Furniture",
      publicResearch: {
        status: "complete",
        provider: "tavily",
        searchedAt: "2026-08-21T00:00:00.000Z",
        sources: [],
        cimDriveUrl:
          "https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view",
        cimDriveFileId: "1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o",
        cimDriveName: "UCT_CIM_6326.pdf",
      },
    });
    applyDealPatch(card, {
      publicResearch: {
        status: "complete",
        provider: "direct_only",
        searchedAt: new Date().toISOString(),
        sources: [],
      },
    });
    expect(card.publicResearch?.provider).toBe("direct_only");
    expect(card.publicResearch?.cimDriveUrl).toBe(
      "https://drive.google.com/file/d/1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o/view"
    );
    expect(card.cimDriveUrl).toBe(card.publicResearch?.cimDriveUrl);
  });

  it("does not open tavily, AIS, extract, or OCR dumps as the CIM", () => {
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
          id: "ocr",
          name: "Furniture-CIM.pdf",
          category: "cim",
          textExcerpt: "CONFIDENTIALINFORMATIONMEMORANDUM",
        }),
      ],
    });
    expect(isDumpDocument(card.documents[0])).toBe(true);
    expect(isDumpDocument(card.documents[1])).toBe(true);
    expect(isDumpDocument(card.documents[2])).toBe(true);
    expect(openCimUrl(card)).toBeNull();
    const scan = companyScan(card);
    expect(scan.openCimUrl).toBeNull();
    expect(scan.dumpDocuments.map((item) => item.name)).toEqual([
      "tavily-lawrence.pdf",
      "ais-tight-copy-deal.pdf",
      "Mighty-Molding-CIM-extract.pdf",
    ]);
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
    expect(card.documents[1].url).toBeUndefined();
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
