import type { Deal, PipelineStatus } from "./types";

export const DEAL_PATCH_FIELDS = [
  "status",
  "teamId",
  "fatalRisks",
  "financing",
  "dealPicture",
  "notes",
  "ownerQuestions",
  "screening",
  "publicResearch",
] as const;

export type DealPatchField = (typeof DEAL_PATCH_FIELDS)[number];

export function applyDealPatch(
  deal: Deal,
  body: Partial<Pick<Deal, DealPatchField>> & Record<string, unknown>
): Deal {
  if (body.status) deal.status = body.status as PipelineStatus;
  if (body.teamId !== undefined) deal.teamId = String(body.teamId);
  if (body.fatalRisks) deal.fatalRisks = body.fatalRisks as Deal["fatalRisks"];
  if (body.financing) deal.financing = body.financing as Deal["financing"];
  if (body.dealPicture) deal.dealPicture = body.dealPicture as Deal["dealPicture"];
  if (body.notes !== undefined) deal.notes = body.notes as Deal["notes"];
  if (body.ownerQuestions)
    deal.ownerQuestions = body.ownerQuestions as Deal["ownerQuestions"];
  if (body.screening) deal.screening = body.screening as Deal["screening"];
  if (body.publicResearch)
    deal.publicResearch = body.publicResearch as Deal["publicResearch"];
  deal.updatedAt = new Date().toISOString();
  return deal;
}
