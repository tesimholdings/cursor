import { describe, expect, it } from "vitest";
import { applyDealPatch } from "./deal-patch";
import {
  companyScan,
  hasRealOwnerQa,
  isFluffOwnerAnswer,
  scanCall,
  scanSummary,
} from "./company-scan";
import {
  documentClickUrl,
  isPrimaryCimDocument,
  primaryCimDocument,
  withClickableDocumentUrls,
} from "./documents";
import { looksLikeOcrDump } from "./copy";
import type { Deal, DocumentRecord, OwnerQuestion } from "./types";

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

describe("company scan CIM and documents", () => {
  it("opens a named CIM/teaser/OM/CBR/exec summary and ignores tavily chips", () => {
    const card = deal({
      documents: [
        doc({ id: "tavily", name: "tavily-uniquecoat.pdf", category: "listing" }),
        doc({ id: "cim", name: "UCT_CIM_6326.pdf", category: "cim", stage: 2 }),
        doc({
          id: "faq",
          name: "SE_Painting_Executive_Summary.pdf",
          category: "cim",
          stage: 2,
        }),
      ],
    });
    expect(isPrimaryCimDocument(card.documents[0])).toBe(false);
    expect(primaryCimDocument(card)?.name).toBe("UCT_CIM_6326.pdf");
    const teaser = deal({
      documents: [doc({ id: "teaser", name: "Listing-Teaser.pdf" })],
    });
    expect(primaryCimDocument(teaser)?.name).toBe("Listing-Teaser.pdf");
    const om = deal({
      documents: [doc({ id: "om", name: "Seller-OM-2026.pdf" })],
    });
    expect(primaryCimDocument(om)?.name).toBe("Seller-OM-2026.pdf");
    const cbr = deal({
      documents: [doc({ id: "cbr", name: "Colom-CBR.pdf" })],
    });
    expect(primaryCimDocument(cbr)?.name).toBe("Colom-CBR.pdf");
    const txt = deal({
      documents: [doc({ id: "txt", name: "Mighty-Molding-CIM.txt", category: "cim" })],
    });
    expect(primaryCimDocument(txt)).toBeNull();
  });

  it("returns a clickable document URL for GET/Open CIM", () => {
    const document = doc({
      id: "cim",
      name: "UCT_CIM_6326.pdf",
      category: "cim",
      blobUrl: "https://blob.vercel-storage.com/uct.pdf",
    });
    expect(documentClickUrl("deal_scan", document, "https://app.example")).toBe(
      "https://blob.vercel-storage.com/uct.pdf"
    );
    const local = doc({ id: "cim2", name: "book.pdf", category: "cim" });
    expect(documentClickUrl("deal_scan", local, "https://app.example")).toBe(
      "https://app.example/api/deals/deal_scan/documents/cim2"
    );
    const hydrated = withClickableDocumentUrls(
      deal({ documents: [local] }),
      "https://app.example"
    );
    expect(hydrated.documents[0].url).toMatch(/\/api\/deals\/deal_scan\/documents\/cim2$/);
  });
});

describe("company scan copy", () => {
  it("maps AIS/IC language to PASS / CONTINUE / RENEGOTIATE / BUY", () => {
    expect(
      scanCall(
        deal({
          dealPicture: {
            version: 7,
            status: "ais_tight",
            summary: "HVAF guns and powder feeders.",
            facts: [],
            risks: [],
            unanswered: [],
            rebuiltAt: new Date().toISOString(),
            scoreLabel: "Board score",
            score: 67,
            closeSpeed: "Mid",
            call: "IC 67 CONTINUE. Box $4.2–4.5M.",
          },
        })
      )
    ).toBe("CONTINUE");
    expect(scanCall(deal({ status: "passed" }))).toBe("PASS");
    expect(
      scanCall(
        deal({
          packet: {
            reviewedAt: new Date().toISOString(),
            score: 40,
            decision: "RENEGOTIATE",
            decisionWhy: "Price.",
            answers: {},
            topQuestions: [],
            fullDiligenceQuestions: [],
            evidence: [],
            whatWeKnow: "",
            whatWeDont: "",
            whyItMatters: "",
            whatNext: "",
            reasonsToBuy: [],
            reasonsToPass: [],
          },
        })
      )
    ).toBe("RENEGOTIATE");
  });

  it("does not render CIM OCR or repeat the legal name, and hides Unanswered rows", () => {
    const ocr = "C O N F I D E N T I A L I N F O R M A T I O N M E M O R A N D U M TRAILING 3-YEAR";
    expect(looksLikeOcrDump(ocr)).toBe(true);
    const card = deal({
      dealPicture: {
        version: 7,
        status: "from_cim",
        summary: ocr,
        ugly: "Founder-inventor key-person.",
        facts: [
          { label: "Ask", value: "$4.95M Seller Claim", kind: "SELLER_CLAIM" },
          { label: "Name", value: "Uniquecoat Technologies, LLC", kind: "CIM_FACT" },
          {
            label: "RE / FF&E",
            value: "Unanswered — not printed in the retained CIM snippet",
            kind: "CIM_FACT",
          },
          { label: "T3 avg SDE", value: "$1,296,396", kind: "CIM_FACT" },
        ],
        risks: [],
        unanswered: [],
        rebuiltAt: new Date().toISOString(),
        scoreLabel: "Board score",
        score: 60,
        closeSpeed: "Mid",
      },
    });
    const scan = companyScan(card);
    expect(scan.summary).toBe("");
    expect(scan.facts.map((fact) => fact.label)).toEqual(["Ask", "T3 avg SDE"]);
    expect(scan.facts.find((fact) => fact.label === "T3 avg SDE")?.kind).toBe(
      "SELLER_CLAIM"
    );
    expect(scan.facts.find((fact) => fact.label === "T3 avg SDE")?.value).toBe(
      "$1,296,396"
    );
    expect(scan.primaryCim).toBeNull();
    expect(scan.nextAction).toMatch(/CIM/i);

    const named = deal({
      name: "Lawrence Furniture",
      dealPicture: {
        version: 7,
        status: "listing_teaser",
        summary:
          "Teaser screen, not an IC. Lawrence Furniture is listed as custom furniture manufacturing.",
        facts: [],
        risks: [],
        unanswered: [],
        rebuiltAt: new Date().toISOString(),
        scoreLabel: "Board score",
        score: 40,
        closeSpeed: "Slow",
      },
    });
    expect(scanSummary(named, named.dealPicture!)).not.toMatch(/Lawrence Furniture/i);

    const withCim = deal({
      documents: [doc({ id: "cim", name: "UCT_CIM_6326.pdf", category: "cim" })],
      dealPicture: {
        version: 7,
        status: "no_cim",
        summary: "No CIM on card. Custom molder serving industrial accounts.",
        facts: [],
        risks: [],
        unanswered: [],
        rebuiltAt: new Date().toISOString(),
        scoreLabel: "Board score",
        score: 48,
        closeSpeed: "Slow",
      },
    });
    expect(scanSummary(withCim, withCim.dealPicture!)).toBe(
      "Custom molder serving industrial accounts."
    );
    expect(scanSummary(withCim, withCim.dealPicture!)).not.toMatch(/No CIM on card/i);
  });

  it("hides template-fluff Owner Q&A", () => {
    const fluff: OwnerQuestion = {
      id: 1,
      section: "business",
      title: "Explain the business",
      answer: "This changes whether the opportunity deserves more time.",
      light: "yellow",
      kind: "NOT_PROVIDED",
      known: [],
      unknown: [],
      why: "This changes whether the opportunity deserves more time.",
      next: "",
      sources: [],
    };
    expect(isFluffOwnerAnswer(fluff)).toBe(true);
    expect(
      hasRealOwnerQa(
        deal({
          ownerQuestions: {
            completedAt: new Date().toISOString(),
            status: "complete",
            questions: [fluff],
            sections: [],
            prospects: [],
            whatWeLike: [],
            concerns: [],
            unanswered: [],
            score: 0,
            decision: "MAYBE",
            decisionWhy: "",
          },
        })
      )
    ).toBe(false);
  });
});

describe("deal PATCH documents metadata", () => {
  it("persists dealPicture, notes, ownerQuestions, screening, and documents metadata", () => {
    const card = deal({
      documents: [doc({ id: "cim", name: "old.pdf", category: "cim" })],
    });
    applyDealPatch(card, {
      notes: "Keep this note.",
      dealPicture: {
        version: 7,
        status: "from_cim",
        summary: "They sell HVAF spray systems and powder feeders.",
        facts: [],
        risks: [],
        unanswered: [],
        rebuiltAt: new Date().toISOString(),
        scoreLabel: "Board score",
        score: 60,
        closeSpeed: "Mid",
      },
      documents: [
        {
          id: "cim",
          dealId: card.id,
          name: "UCT_CIM_6326.pdf",
          category: "cim",
          stage: 2,
          uploadedAt: new Date().toISOString(),
          size: 10,
          url: "https://blob.vercel-storage.com/uct.pdf",
          blobUrl: "https://blob.vercel-storage.com/uct.pdf",
        },
      ],
    });
    expect(card.notes).toBe("Keep this note.");
    expect(card.dealPicture?.summary).toMatch(/HVAF/);
    expect(card.documents[0].name).toBe("UCT_CIM_6326.pdf");
    expect(card.documents[0].url).toBe("https://blob.vercel-storage.com/uct.pdf");
  });
});
