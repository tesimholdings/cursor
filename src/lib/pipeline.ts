import type { Deal, Store } from "./types";
import { companyHighlights } from "./deal-brief";

export type BrokerCall = "INQUIRE + NDA" | "NEED MORE" | "PASS";
export type FunnelStepNumber = 1 | 2 | 3 | 4 | 5;

export const FUNNEL_STEPS: Array<{
  key: FunnelStepNumber;
  label: string;
  shortLabel: string;
}> = [
  {
    key: 1,
    label: "1. Listing / teaser screen (pre-NDA)",
    shortLabel: "Listing / teaser",
  },
  { key: 2, label: "2. NDA + CIM", shortLabel: "NDA + CIM" },
  {
    key: 3,
    label: "3. Financials / QoE packet",
    shortLabel: "Financials / QoE",
  },
  { key: 4, label: "4. Full IC", shortLabel: "Full IC" },
  {
    key: 5,
    label: "5. LOI / price / structure",
    shortLabel: "LOI / structure",
  },
];

export const PIPELINE_COLUMNS = FUNNEL_STEPS;

export function canRunFullIc(deal: Deal) {
  return deal.documents.some(
    (document) =>
      document.category === "financials" &&
      document.extraction?.status === "complete" &&
      document.extraction.chunks.length > 0
  );
}

export function dealFunnelStep(deal: Deal): FunnelStepNumber {
  if (
    ["loi", "financing", "closing", "acquired"].includes(deal.status)
  ) {
    return 5;
  }
  if (deal.diligence && canRunFullIc(deal)) return 4;
  if (canRunFullIc(deal)) return 3;
  if (
    ["nda_requested", "waiting_packet", "packet_review"].includes(deal.status) ||
    deal.documents.some((document) => document.category === "cim")
  ) {
    return 2;
  }
  return 1;
}

export function brokerCall(deal: Deal): BrokerCall {
  if (deal.status === "passed" || deal.screening?.decision === "PASS")
    return "PASS";
  if (deal.screening?.decision === "REQUEST_NDA") return "INQUIRE + NDA";
  return "NEED MORE";
}

export function brokerScreen(deal: Deal) {
  const highlights = companyHighlights(deal);
  return {
    score:
      deal.screening?.preNdaScore ?? deal.ownerQuestions?.score ?? null,
    good: highlights.good,
    bad: highlights.bad,
    interesting: highlights.interesting,
    call: brokerCall(deal),
    step: dealFunnelStep(deal),
  };
}

export function funnel(deals: Deal[]) {
  return FUNNEL_STEPS.map((step) => ({
    label: step.label,
    value: deals.filter((deal) => dealFunnelStep(deal) === step.key).length,
  }));
}

export function stageCopy(deal: Deal): {
  stageLabel: string;
  needToDo: string;
  nextButton?: { label: string; action: string };
} {
  const step = dealFunnelStep(deal);
  if (deal.status === "passed") {
    return {
      stageLabel: `Step ${step} of 5 — Passed`,
      needToDo: "Nothing. Preserve the original screen and evidence trail.",
    };
  }
  if (step === 1) {
    if (!deal.ownerQuestions || deal.researchStatus !== "complete") {
      return {
        stageLabel: "Step 1 of 5 — Listing / teaser screen (pre-NDA)",
        needToDo:
          deal.researchStatus === "running"
            ? "Nothing yet. Public research and the Owner Questions are running."
            : "Run the listing / teaser screen.",
      };
    }
    if (deal.screening?.decision === "REQUEST_NDA") {
      return {
        stageLabel: "Step 1 of 5 — Listing / teaser screen (pre-NDA)",
        needToDo:
          "Review Good / Bad / Interesting, then decide whether to inquire and sign the NDA.",
        nextButton: { label: "Inquire + NDA", action: "nda" },
      };
    }
    if (deal.screening?.decision === "PASS") {
      return {
        stageLabel: "Step 1 of 5 — Listing / teaser screen (pre-NDA)",
        needToDo: "The broker call is PASS. Confirm it or preserve as NEED MORE.",
        nextButton: { label: "Pass", action: "pass" },
      };
    }
    return {
      stageLabel: "Step 1 of 5 — Listing / teaser screen (pre-NDA)",
      needToDo:
        "Get the few missing broker answers before signing an NDA.",
      nextButton: { label: "Inquire + NDA anyway", action: "nda" },
    };
  }
  if (step === 2) {
    return {
      stageLabel: "Step 2 of 5 — NDA + CIM",
      needToDo: deal.packet
        ? "Review the CIM screen, then upload financials / QoE when received."
        : "Complete the NDA and upload the CIM. Do not run a Full IC from teaser SDE.",
      nextButton:
        deal.status === "nda_requested"
          ? { label: "Mark waiting for CIM", action: "wait_packet" }
          : undefined,
    };
  }
  if (step === 3) {
    return {
      stageLabel: "Step 3 of 5 — Financials / QoE packet",
      needToDo:
        "Readable financial materials are attached. Review extraction status, then run the Full IC.",
    };
  }
  if (step === 4) {
    return {
      stageLabel: "Step 4 of 5 — Full IC",
      needToDo:
        "Review the 0–100 IC score, fatal risks, maximum price, structure, and walk triggers.",
      nextButton: { label: "Move to LOI / structure", action: "loi" },
    };
  }
  return {
    stageLabel: "Step 5 of 5 — LOI / price / structure",
    needToDo:
      deal.status === "loi"
        ? "Negotiate price, seller protections, working capital, and financing."
        : deal.status === "financing"
          ? "Confirm lender terms and downside debt coverage."
          : deal.status === "closing"
            ? "Close only after every pre-close condition is satisfied."
            : "Execute the approved structure and 100-day plan.",
    nextButton:
      deal.status === "loi"
        ? { label: "Move to financing", action: "financing" }
        : deal.status === "financing"
          ? { label: "Move to closing", action: "closing" }
          : deal.status === "closing"
            ? { label: "Mark acquired", action: "acquired" }
            : undefined,
  };
}

export function researchProgress(store: Store) {
  const total = store.deals.length;
  const done = store.deals.filter(
    (deal) =>
      deal.researchStatus === "complete" &&
      Boolean(deal.publicResearch) &&
      deal.ownerQuestions?.status === "complete"
  ).length;
  const running = store.deals.filter(
    (deal) => deal.researchStatus === "running"
  ).length;
  const pending = store.deals.filter(
    (deal) =>
      deal.researchStatus === "pending" ||
      !deal.publicResearch ||
      !deal.ownerQuestions
  ).length;
  return { total, done, running, pending };
}
