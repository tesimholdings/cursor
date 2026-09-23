import type { PacketDecision, PreNdaDecision } from "./types";

export function scoreStage1(input: {
  wantToOwn: boolean;
  valuation: "Cheap" | "Reasonable" | "Expensive" | "Unknown";
  missingFinancials: boolean;
  sizeOk: boolean;
  realEstate: boolean | null;
  sellerFinancing: boolean | null;
  askingPrice?: number | null;
  revenue?: number | null;
  earnings?: number | null;
  industryQualityBase: number;
}) {
  let score = 40;
  const industryQuality = input.industryQualityBase;
  let growth = 50;
  let assets = 45;

  if (input.wantToOwn) score += 18;
  else score -= 12;

  if (input.valuation === "Cheap") score += 16;
  if (input.valuation === "Reasonable") score += 10;
  if (input.valuation === "Expensive") score -= 14;
  if (input.valuation === "Unknown") score -= 4;

  if (input.missingFinancials) score -= 18;
  else score += 8;

  if (input.sizeOk) score += 6;
  if (input.realEstate) {
    score += 6;
    assets += 20;
  }
  if (input.sellerFinancing) score += 5;
  if (input.earnings && input.revenue && input.earnings / input.revenue >= 0.15) {
    score += 8;
    growth += 10;
  }
  if (input.askingPrice && input.askingPrice >= 5_000_000 && input.askingPrice <= 10_000_000) {
    score += 4;
  }

  score = clamp(score);
  growth = clamp(growth + (input.wantToOwn ? 15 : -10));
  assets = clamp(assets);

  let decision: PreNdaDecision = "MAYBE";
  let why = "A couple of important numbers or facts are still missing.";
  if (score >= 68 && input.wantToOwn && !input.missingFinancials) {
    decision = "REQUEST_NDA";
    why = "Needed industry, numbers in range, and nothing obviously fatal at listing level. Worth an NDA.";
  } else if (score < 48 || (!input.wantToOwn && input.valuation === "Expensive")) {
    decision = "PASS";
    why = "Either the category is unattractive or the listing does not justify more time.";
  }

  return { score, decision, why, industryQuality, growth, assets };
}

export function scorePacket(flags: {
  numbersMatch: boolean;
  conflict: boolean;
  declining: boolean;
  addbacksAggressive: boolean;
  ownerDependent: boolean;
  concentrated: boolean;
  growthPlausible: boolean;
}): { score: number; decision: PacketDecision; why: string } {
  let score = 62;
  if (flags.numbersMatch) score += 10;
  if (flags.conflict) score -= 18;
  if (flags.declining) score -= 12;
  if (flags.addbacksAggressive) score -= 10;
  if (flags.ownerDependent) score -= 8;
  if (flags.concentrated) score -= 10;
  if (flags.growthPlausible) score += 8;
  score = clamp(score);

  let decision: PacketDecision = "ASK_FOLLOWUP";
  let why = "The packet helped, but we still need a short list of answers before an LOI.";
  if (flags.conflict && flags.declining) {
    decision = "PASS";
    why = "Reported numbers conflict and the trend is down. Not worth a full diligence sprint.";
  } else if (score >= 72 && !flags.conflict) {
    decision = "ADVANCE_LOI";
    why = "Packet supports a serious look. Move to diligence / LOI with conditions.";
  } else if (flags.addbacksAggressive || flags.concentrated) {
    decision = "RENEGOTIATE";
    why = "The business may be real, but price or terms should move before we spend full diligence dollars.";
  }
  return { score, decision, why };
}

export function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}
