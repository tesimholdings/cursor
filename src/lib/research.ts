import { updateStore } from "./store";
import { buildStage1 } from "./screening";
import { enrichScreening } from "./ai";

export async function researchNext(limit = 3) {
  return updateStore(async (store) => {
    const next = store.deals.filter((d) => d.researchStatus === "pending").slice(0, limit);
    for (const deal of next) {
      deal.researchStatus = "running";
      deal.status = "screening";
      deal.updatedAt = new Date().toISOString();
      try {
        let screening = buildStage1(deal);
        screening = await enrichScreening(deal, screening);
        deal.screening = screening;
        deal.researchStatus = "complete";
        deal.status = screening.decision === "PASS" ? "passed" : "screened";
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

export async function researchDeal(id: string) {
  return updateStore(async (store) => {
    const deal = store.deals.find((d) => d.id === id);
    if (!deal) throw new Error("Deal not found");
    if (deal.researchStatus === "complete" && deal.screening) return deal;
    deal.researchStatus = "running";
    deal.status = "screening";
    let screening = buildStage1(deal);
    screening = await enrichScreening(deal, screening);
    deal.screening = screening;
    deal.researchStatus = "complete";
    deal.status = screening.decision === "PASS" ? "passed" : "screened";
    deal.updatedAt = new Date().toISOString();
    return deal;
  });
}
