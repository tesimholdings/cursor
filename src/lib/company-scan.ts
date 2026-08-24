import { openCimUrl } from "./cim-drive";
import { headlineScore } from "./board-scoring";
import { closeSpeedFor } from "./close-speed";
import {
  firstSentences,
  isTemplateWhy,
  looksLikeOcrDump,
  stripRepeatedName,
} from "./copy";
import { buildDealPicture, visibleDealPictureFacts } from "./deal-picture";
import { dumpDocuments, listedDocuments, primaryCimDocument } from "./documents";
import { money } from "./format";
import {
  dealFunnelStep,
  FUNNEL_STEPS,
  stageCopy,
  type FunnelStepNumber,
} from "./pipeline";
import type {
  Deal,
  DealPicture,
  DealPictureFact,
  DocumentRecord,
  OwnerQuestion,
  OwnerQuestionReport,
} from "./types";

export type ScanCall = "PASS" | "CONTINUE" | "RENEGOTIATE" | "BUY";

const CALL_TOKEN = /\b(PASS|CONTINUE|RENEGOTIATE|BUY)\b/i;

export function scanCall(deal: Deal): ScanCall {
  if (deal.status === "passed") return "PASS";
  const ic = deal.diligence?.finalDecision;
  if (ic === "STRONG BUY" || ic === "BUY SUBJECT TO CONDITIONS") return "BUY";
  if (ic === "CONTINUE DILIGENCE") return "CONTINUE";
  if (ic === "RENEGOTIATE") return "RENEGOTIATE";
  if (ic === "PASS") return "PASS";

  const fromPicture = parseCallToken(deal.dealPicture?.call);
  if (fromPicture) return fromPicture;

  const packet = deal.packet?.decision;
  if (packet === "ADVANCE_LOI") return "BUY";
  if (packet === "ASK_FOLLOWUP") return "CONTINUE";
  if (packet === "RENEGOTIATE") return "RENEGOTIATE";
  if (packet === "PASS") return "PASS";

  const screen = deal.screening?.decision || deal.ownerQuestions?.decision;
  if (screen === "PASS") return "PASS";
  return "CONTINUE";
}

function parseCallToken(value?: string) {
  if (!value) return null;
  const match = value.match(CALL_TOKEN);
  if (!match) return null;
  return match[1].toUpperCase() as ScanCall;
}

export function isUnansweredFact(fact: DealPictureFact) {
  if (fact.kind === "UNANSWERED") return true;
  return /^unanswered\b/i.test(fact.value.trim());
}

export function displayFacts(deal: Deal, picture: DealPicture): DealPictureFact[] {
  return visibleDealPictureFacts(picture.facts)
    .filter((fact) => !isUnansweredFact(fact))
    .filter((fact) => fact.label.toLowerCase() !== "name")
    .slice(0, 8)
    .map((fact) => recastSellerClaim(fact, deal))
    .map(compactFactValue);
}

function recastSellerClaim(fact: DealPictureFact, deal: Deal): DealPictureFact {
  const earningsLike = /sde|ebitda|earnings|recast/i.test(fact.label);
  if (!earningsLike) return fact;
  if (
    deal.earningsQuality === "Tax-tied" &&
    !/recast|add-back/i.test(fact.value)
  ) {
    return fact;
  }
  const already = /seller claim/i.test(fact.value);
  return {
    ...fact,
    kind: "SELLER_CLAIM",
    value: already ? fact.value : `${fact.value} (Seller Claim)`,
  };
}

function compactFactValue(fact: DealPictureFact): DealPictureFact {
  if (fact.kind !== "SELLER_CLAIM") return fact;
  return {
    ...fact,
    value: fact.value
      .replace(/\s*\((Seller Claim(?:\s*[—–-]\s*recast)?)\)/gi, "")
      .replace(/\s+Seller Claim(?:\s*[—–-]\s*recast)?/gi, "")
      .trim(),
  };
}

export function scanSummary(deal: Deal, picture: DealPicture) {
  let summary = picture.summary || "";
  if (primaryCimDocument(deal)) {
    summary = summary.replace(/^No CIM on card\.?\s*/i, "");
  }
  if (picture.ugly) {
    summary = summary.replace(picture.ugly, " ");
  }
  summary = summary.replace(/\s*Ugly:\s*.*$/i, "").trim();
  summary = stripRepeatedName(summary, deal.name);
  summary = firstSentences(summary, 3);
  if (!summary || looksLikeOcrDump(summary)) return "";
  if (
    /confidentialinformationmemorandum|confidential information memorandum|c o n f i d e n t i a l/i.test(
      summary.replace(/\s+/g, "")
    )
  ) {
    return "";
  }
  return summary;
}

export function scanUgly(deal: Deal, picture: DealPicture) {
  const ugly = stripRepeatedName(
    (picture.ugly || "").replace(/^ugly:\s*/i, "").trim(),
    deal.name
  );
  if (!ugly || looksLikeOcrDump(ugly)) return "";
  return ugly;
}

export function maxWalkLine(deal: Deal, picture: DealPicture) {
  const storedCall = (picture.call || "").trim();
  if (storedCall) return stripRepeatedName(storedCall, deal.name);
  const fact = displayFacts(deal, picture).find((item) =>
    /max|walk/i.test(item.label)
  );
  if (fact) return fact.value;
  const max = deal.diligence?.maxPrice;
  if (max?.value == null) return "";
  const walk = deal.diligence?.walkTriggers?.[0];
  return walk
    ? `Max ${money(max.value)}. ${walk}`
    : `Max ${money(max.value)} — ${max.basis}`;
}

export function scanAsk(deal: Deal, picture: DealPicture) {
  const fact = displayFacts(deal, picture).find(
    (item) => item.label.toLowerCase() === "ask"
  );
  if (fact) return fact.value;
  if (deal.askingPrice != null) return `${money(deal.askingPrice)} (Seller Claim)`;
  return "";
}

export function isFluffOwnerAnswer(question: OwnerQuestion) {
  const answer = (question.answer || "").trim();
  if (!answer) return true;
  if (/^unanswered\b/i.test(answer)) return true;
  if (looksLikeOcrDump(answer)) return true;
  if (isTemplateWhy(answer) || /deserves more time/i.test(answer)) return true;
  if (isTemplateWhy(question.why) && /^this (fact )?changes /i.test(answer)) {
    return true;
  }
  return false;
}

export function realOwnerQuestions(report?: OwnerQuestionReport) {
  return (report?.questions || []).filter(
    (question) => !isFluffOwnerAnswer(question)
  );
}

export function hasRealOwnerQa(deal: Deal) {
  return realOwnerQuestions(deal.ownerQuestions).length > 0;
}

export function scanNextAction(deal: Deal) {
  if (deal.status === "passed") return "Passed. Nothing further.";
  const step = dealFunnelStep(deal);
  const cim = primaryCimDocument(deal);
  if (step === 1) {
    return cim
      ? "Open the teaser, then inquire + NDA or pass."
      : "No CIM on this card. Inquire + NDA, or pass.";
  }
  if (step === 2) {
    return cim
      ? "Read the CIM. Upload financials/QoE when they arrive."
      : "Get the CIM onto this card.";
  }
  if (step === 3) return "Review financials/QoE, then run Full IC.";
  if (step === 4) return "Review IC, max/walk, then move to LOI or pass.";
  const guide = stageCopy(deal);
  return firstSentences(guide.needToDo, 1);
}

export interface CompanyScan {
  name: string;
  score: number;
  scoreLabel: "Board score" | "IC score";
  call: ScanCall;
  closeSpeed: ReturnType<typeof closeSpeedFor>;
  ask: string;
  summary: string;
  facts: DealPictureFact[];
  ugly: string;
  callLine: string;
  primaryCim: DocumentRecord | null;
  openCimUrl: string | null;
  otherDocuments: DocumentRecord[];
  dumpDocuments: DocumentRecord[];
  funnelStep: FunnelStepNumber;
  funnelSteps: typeof FUNNEL_STEPS;
  nextAction: string;
}

export function companyScan(deal: Deal): CompanyScan {
  const picture = deal.dealPicture || buildDealPicture(deal);
  const headline = headlineScore(deal);
  const primaryCim = primaryCimDocument(deal);
  const href = openCimUrl(deal);
  return {
    name: deal.name,
    score: headline.score,
    scoreLabel: headline.label,
    call: scanCall(deal),
    closeSpeed: closeSpeedFor(deal),
    ask: scanAsk(deal, picture),
    summary: scanSummary(deal, picture),
    facts: displayFacts(deal, picture),
    ugly: scanUgly(deal, picture),
    callLine: maxWalkLine(deal, picture) || scanCall(deal),
    primaryCim,
    openCimUrl: href,
    otherDocuments: listedDocuments(deal, primaryCim),
    dumpDocuments: dumpDocuments(deal),
    funnelStep: dealFunnelStep(deal),
    funnelSteps: FUNNEL_STEPS,
    nextAction: scanNextAction(deal),
  };
}
