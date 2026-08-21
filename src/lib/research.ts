import { updateStore } from "./store";
import { buildStage1 } from "./screening";
import { enrichOwnerQuestions } from "./ai";
import { buildOwnerQuestions } from "./owner-questions";
import { researchCompany } from "./public-research";
import { refreshDealFromDocuments } from "./refresh-deal";
import { firstSentences } from "./copy";
import { cimProse, hasReadableCim } from "./deal-picture";

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
        refreshDealFromDocuments(deal);
        deal.publicResearch = await researchCompany(deal);
        deal.ownerQuestions = await enrichOwnerQuestions(
          deal,
          deal.ownerQuestions || buildOwnerQuestions(deal),
          deal.publicResearch
        );
        if (deal.ownerQuestions && hasReadableCim(deal)) {
          deal.ownerQuestions.companyBrief = firstSentences(
            cimProse(deal, 5) || deal.ownerQuestions.companyBrief || "",
            5
          );
        }
        const screening = buildStage1(deal);
        deal.screening = screening;
        refreshDealFromDocuments(deal, { rewriteQa: false });
        deal.researchStatus = "complete";
        if (hasReadableCim(deal) && !["loi", "financing", "closing", "acquired", "passed"].includes(priorStatus)) {
          deal.status = deal.diligence ? "diligence" : "packet_review";
        } else if (!ADVANCED.has(priorStatus)) {
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
    refreshDealFromDocuments(deal);
    deal.publicResearch = await researchCompany(deal);
    deal.ownerQuestions = await enrichOwnerQuestions(
      deal,
      deal.ownerQuestions || buildOwnerQuestions(deal),
      deal.publicResearch
    );
    if (deal.ownerQuestions && hasReadableCim(deal)) {
      deal.ownerQuestions.companyBrief = firstSentences(
        cimProse(deal, 5) || deal.ownerQuestions.companyBrief || "",
        5
      );
    }
    const screening = buildStage1(deal);
    deal.screening = screening;
    refreshDealFromDocuments(deal, { rewriteQa: false });
    deal.researchStatus = "complete";
    deal.status =
      hasReadableCim(deal) &&
      !["loi", "financing", "closing", "acquired", "passed"].includes(priorStatus)
        ? deal.diligence
          ? "diligence"
          : "packet_review"
        : ADVANCED.has(priorStatus)
          ? priorStatus
          : screening.decision === "PASS"
            ? "passed"
            : "screened";
    deal.updatedAt = new Date().toISOString();
    return deal;
  });
}
