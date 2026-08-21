import { updateStore } from "./store";
import { buildStage1 } from "./screening";
import { enrichOwnerQuestions } from "./ai";
import { buildOwnerQuestions } from "./owner-questions";
import { researchCompany } from "./public-research";

const ADVANCED = new Set([
  "nda_requested",
  "waiting_packet",
  "packet_review",
  "diligence",
  "loi",
  "financing",
  "closing",
  "acquired",
]);

export async function researchNext(limit = 3) {
  return updateStore(async (store) => {
    const next = store.deals
      .filter(
        (d) =>
          d.researchStatus === "pending" ||
          !d.ownerQuestions ||
          !d.publicResearch
      )
      .slice(0, limit);
    for (const deal of next) {
      const priorStatus = deal.status;
      deal.researchStatus = "running";
      if (!ADVANCED.has(priorStatus)) deal.status = "screening";
      deal.updatedAt = new Date().toISOString();
      try {
        // Mandatory ordering: Step 1A is persisted before Step 1B is created.
        deal.publicResearch = await researchCompany(deal);
        deal.ownerQuestions = await enrichOwnerQuestions(
          deal,
          buildOwnerQuestions(deal),
          deal.publicResearch
        );
        const screening = buildStage1(deal);
        deal.screening = screening;
        deal.researchStatus = "complete";
        if (!ADVANCED.has(priorStatus)) {
          deal.status = screening.decision === "PASS" ? "passed" : "screened";
        } else {
          deal.status = priorStatus;
        }
      } catch (err) {
        deal.researchStatus = "error";
        deal.researchError = err instanceof Error ? err.message : "Research failed";
        deal.status = "imported";
      }
      deal.updatedAt = new Date().toISOString();
    }
    return next.map((d) => d.id);
  });
}

export async function researchDeal(id: string, options: { force?: boolean } = {}) {
  return updateStore(async (store) => {
    const deal = store.deals.find((d) => d.id === id);
    if (!deal) throw new Error("Deal not found");
    if (
      !options.force &&
      deal.researchStatus === "complete" &&
      deal.publicResearch &&
      deal.ownerQuestions &&
      deal.screening
    )
      return deal;
    const priorStatus = deal.status;
    deal.researchStatus = "running";
    if (!ADVANCED.has(priorStatus)) deal.status = "screening";
    deal.publicResearch = await researchCompany(deal);
    deal.ownerQuestions = await enrichOwnerQuestions(
      deal,
      buildOwnerQuestions(deal),
      deal.publicResearch
    );
    const screening = buildStage1(deal);
    deal.screening = screening;
    deal.researchStatus = "complete";
    deal.status = ADVANCED.has(priorStatus)
      ? priorStatus
      : screening.decision === "PASS"
        ? "passed"
        : "screened";
    deal.updatedAt = new Date().toISOString();
    return deal;
  });
}
