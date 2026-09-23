import { attachKnownCimDriveUrl } from "./cim-drive";
import { analyzePacket, applyPacketAssignments } from "./packet";
import { buildOwnerQuestions } from "./owner-questions";
import { buildStage1 } from "./screening";
import { runDiligence } from "./diligence";
import { canRunFullIc } from "./pipeline";
import {
  buildDealPicture,
  DEAL_PICTURE_VERSION,
  hasReadableCim,
  tightenStoredNotes,
} from "./deal-picture";
import { firstSentences, looksLikeOcrDump } from "./copy";
import type { Deal } from "./types";

const PRESERVE_STATUS = new Set([
  "diligence",
  "loi",
  "financing",
  "closing",
  "acquired",
  "passed",
]);

export function refreshDealFromDocuments(
  deal: Deal,
  options: { rewriteQa?: boolean } = {}
): boolean {
  const rewriteQa = options.rewriteQa !== false;
  const before = snapshot(deal);
  const cim = hasReadableCim(deal);

  if (cim) {
    deal.packet = analyzePacket(deal, "", deal.documents);
    applyPacketAssignments(deal);
    if (!PRESERVE_STATUS.has(deal.status)) {
      deal.status = "packet_review";
    }
    if (canRunFullIc(deal) && (rewriteQa || !deal.diligence)) {
      deal.diligence = runDiligence(deal);
    }
  }

  if (rewriteQa || !deal.ownerQuestions) {
    deal.ownerQuestions = buildOwnerQuestions(deal);
    if (deal.ownerQuestions) {
      deal.screening = buildStage1(deal);
    }
  }

  const picture = buildDealPicture(deal);
  deal.dealPicture = keepReadablePicture(deal.dealPicture, picture);
  if (deal.ownerQuestions) {
    deal.ownerQuestions.companyBrief = firstSentences(
      deal.dealPicture.summary || deal.ownerQuestions.companyBrief || "",
      3
    );
  }
  const nextNotes = tightenStoredNotes(deal, deal.dealPicture.summary);
  if (nextNotes !== undefined) deal.notes = nextNotes;
  deal.updatedAt = new Date().toISOString();
  return snapshot(deal) !== before;
}

function keepReadablePicture(
  stored: Deal["dealPicture"] | undefined,
  built: NonNullable<Deal["dealPicture"]>
): NonNullable<Deal["dealPicture"]> {
  const storedOk =
    Boolean(stored?.summary) && !looksLikeOcrDump(stored?.summary);
  if (storedOk && stored) {
    return {
      ...stored,
      score: built.score,
      scoreLabel: built.scoreLabel,
      closeSpeed: built.closeSpeed,
      rebuiltAt: built.rebuiltAt,
    };
  }
  if (looksLikeOcrDump(built.summary)) {
    return { ...built, summary: "" };
  }
  return built;
}

export function ensureDealRefresh(deal: Deal): boolean {
  const linked = attachKnownCimDriveUrl(deal);
  const stale =
    deal.dealPicture?.version !== DEAL_PICTURE_VERSION ||
    (hasReadableCim(deal) && !deal.packet) ||
    (hasReadableCim(deal) &&
      !["packet_review", "diligence", "loi", "financing", "closing", "acquired"].includes(
        deal.status
      ) &&
      deal.status !== "passed");
  if (!stale && deal.dealPicture) return linked;
  return refreshDealFromDocuments(deal) || linked;
}

export function ensureStoreDealRefresh(deals: Deal[]): boolean {
  return deals.reduce(
    (changed, deal) => ensureDealRefresh(deal) || changed,
    false
  );
}

function snapshot(deal: Deal) {
  return JSON.stringify({
    picture: deal.dealPicture,
    packetScore: deal.packet?.score,
    brief: deal.ownerQuestions?.companyBrief,
    notes: deal.notes,
    status: deal.status,
    ic: deal.diligence?.scores.total,
  });
}
