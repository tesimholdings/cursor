import { describe, expect, it } from "vitest";
import { scoreStage1, scorePacket, clamp } from "./scoring";
import { computeFinancing, pmt } from "./finance";
import { parseMoney } from "./format";
import { roleForQuestion } from "./assign";
import { buildStage1 } from "./screening";
import type { Deal } from "./types";

describe("scoring", () => {
  it("recommends NDA for a needed, reasonably priced listing", () => {
    const r = scoreStage1({
      wantToOwn: true,
      valuation: "Reasonable",
      missingFinancials: false,
      sizeOk: true,
      realEstate: true,
      sellerFinancing: true,
      askingPrice: 7_000_000,
      revenue: 4_000_000,
      earnings: 1_000_000,
      industryQualityBase: 78,
    });
    expect(r.decision).toBe("REQUEST_NDA");
    expect(r.score).toBeGreaterThanOrEqual(68);
  });

  it("passes weak expensive discretionary names via packet conflict+decline", () => {
    const r = scorePacket({
      numbersMatch: false,
      conflict: true,
      declining: true,
      addbacksAggressive: true,
      ownerDependent: true,
      concentrated: true,
      growthPlausible: false,
    });
    expect(r.decision).toBe("PASS");
  });

  it("clamps", () => {
    expect(clamp(140)).toBe(100);
    expect(clamp(-4)).toBe(0);
  });
});

describe("finance", () => {
  it("computes DSCR", () => {
    const annual = pmt(3_000_000, 0.08, 10);
    const r = computeFinancing(
      {
        purchasePrice: 6_000_000,
        buyerEquity: 1_200_000,
        bankDebt: 3_000_000,
        sbaDebt: 0,
        realEstateDebt: 0,
        sellerNote: 0,
        equipmentFinancing: 0,
        earnout: 0,
        holdback: 0,
        interestRate: 0.08,
        termYears: 10,
        sellerRate: 0.06,
        sellerYears: 5,
      },
      1_000_000
    );
    expect(r.annualDebtService).toBeCloseTo(annual, 0);
    expect(r.dscr).not.toBeNull();
    expect(r.dscr!).toBeGreaterThan(1);
  });
});

describe("parse", () => {
  it("parses money suffixes", () => {
    expect(parseMoney("$4.2M")).toBe(4_200_000);
    expect(parseMoney("890k")).toBe(890_000);
  });
});

describe("assign", () => {
  it("routes legal vs cpa", () => {
    expect(roleForQuestion("Please review customer contracts")).toBe("Attorney");
    expect(roleForQuestion("Tie revenue to tax returns")).toBe("CPA");
    expect(roleForQuestion("Model DSCR for the SBA loan")).toBe("Financial Planner");
  });
});

describe("screening honesty", () => {
  it("does not invent capacity", () => {
    const deal = {
      id: "x",
      batchId: "b",
      name: "Test Molder",
      industry: "Injection molding",
      location: "OH",
      askingPrice: 6_000_000,
      revenue: 4_000_000,
      sde: 900_000,
      realEstateIncluded: false,
      sellerFinancing: false,
      status: "imported",
      researchStatus: "pending",
      createdAt: "",
      updatedAt: "",
      documents: [],
      assignedQuestions: [],
      fatalRisks: [],
    } as Deal;
    const s = buildStage1(deal);
    const cap = s.questions.find((q) => q.id === 13);
    expect(cap?.answer).toMatch(/KEY DUE DILIGENCE QUESTION/);
    expect(s.prospects.length).toBeGreaterThanOrEqual(20);
  });
});
