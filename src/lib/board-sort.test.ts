import { describe, expect, it } from "vitest";
import {
  dealBoardCategory,
  sortBrokerBoard,
  sortDealsByCategory,
  sortDealsByRecent,
} from "./board-scoring";
import type { Deal } from "./types";

function deal(partial: Partial<Deal> & Pick<Deal, "id" | "name">): Deal {
  return {
    batchId: "batch",
    industry: "Other",
    location: "Austin, TX",
    askingPrice: null,
    realEstateIncluded: null,
    sellerFinancing: null,
    status: "screened",
    researchStatus: "complete",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    documents: [],
    assignedQuestions: [],
    fatalRisks: [],
    ...partial,
  };
}

describe("newest and category board sort", () => {
  it("sorts newest createdAt first and parks missing dates last", () => {
    const older = deal({
      id: "older",
      name: "Older",
      createdAt: "2026-03-01T00:00:00.000Z",
    });
    const newer = deal({
      id: "newer",
      name: "Newer",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const blank = deal({ id: "blank", name: "Blank", createdAt: "" });
    const junk = deal({ id: "junk", name: "Junk", createdAt: "not-a-date" });
    expect(
      sortDealsByRecent([older, blank, newer, junk]).map((item) => item.name)
    ).toEqual(["Newer", "Older", "Blank", "Junk"]);
    expect(sortBrokerBoard([older, newer], "recent")[0].name).toBe("Newer");
  });

  it("groups by the stored business category and parks Unknown last", () => {
    const trades = deal({
      id: "trades",
      name: "Zebra Trades",
      businessCategory: "Construction / trades",
    });
    const gas = deal({
      id: "gas",
      name: "Alpha Fuel",
      businessCategory: "Gas / C-store",
    });
    const otherGas = deal({
      id: "gas2",
      name: "Beta Fuel",
      businessCategory: "Gas / C-store",
    });
    const unknown = deal({
      id: "unknown",
      name: "No Category",
      industry: "",
      businessCategory: "Unknown",
    });
    const missing = deal({
      id: "missing",
      name: "Also Missing",
      industry: "",
    });
    expect(dealBoardCategory(missing)).toBe("Unknown");
    expect(
      sortDealsByCategory([unknown, trades, otherGas, missing, gas]).map(
        (item) => item.name
      )
    ).toEqual([
      "Zebra Trades",
      "Alpha Fuel",
      "Beta Fuel",
      "Also Missing",
      "No Category",
    ]);
  });
});
