import type { Deal, PipelineStatus, Store } from "./types";

export const PIPELINE_COLUMNS: { key: PipelineStatus | "screened"; label: string; statuses: PipelineStatus[] }[] = [
  { key: "imported", label: "New deals to screen", statuses: ["imported", "screening"] },
  { key: "screened", label: "Screened", statuses: ["screened"] },
  { key: "nda_requested", label: "NDA requested", statuses: ["nda_requested"] },
  { key: "waiting_packet", label: "Waiting for packets", statuses: ["waiting_packet"] },
  { key: "packet_review", label: "Packets received", statuses: ["packet_review"] },
  { key: "diligence", label: "Under diligence", statuses: ["diligence"] },
  { key: "loi", label: "LOI", statuses: ["loi"] },
  { key: "financing", label: "Financing", statuses: ["financing"] },
  { key: "closing", label: "Closing", statuses: ["closing"] },
  { key: "passed", label: "Passed", statuses: ["passed"] },
];

export function funnel(deals: Deal[]) {
  const n = deals.length;
  const researched = deals.filter((d) => d.researchStatus === "complete").length;
  const worthNda = deals.filter((d) => d.screening?.decision === "REQUEST_NDA" || ["nda_requested", "waiting_packet", "packet_review", "diligence", "loi", "financing", "closing", "acquired"].includes(d.status)).length;
  const packets = deals.filter((d) => d.documents.some((x) => x.stage >= 2) || ["packet_review", "diligence", "loi", "financing", "closing", "acquired"].includes(d.status)).length;
  const advanced = deals.filter((d) => ["diligence", "loi", "financing", "closing", "acquired"].includes(d.status)).length;
  const lois = deals.filter((d) => ["loi", "financing", "closing", "acquired"].includes(d.status)).length;
  const finalDil = deals.filter((d) => ["financing", "closing", "acquired"].includes(d.status) || (d.status === "diligence" && d.diligence)).length;
  const acquired = deals.filter((d) => d.status === "acquired").length;
  return [
    { label: "Businesses imported", value: n },
    { label: "Researched", value: researched },
    { label: "Worth NDA", value: worthNda },
    { label: "Packets received", value: packets },
    { label: "Advanced", value: advanced },
    { label: "LOIs", value: lois },
    { label: "Final diligence", value: finalDil },
    { label: "Acquisition", value: acquired },
  ];
}

export function stageCopy(deal: Deal): {
  stageLabel: string;
  needToDo: string;
  nextButton?: { label: string; action: string };
} {
  if (deal.status === "passed") {
    return { stageLabel: "Passed — we are not buying this one", needToDo: "Nothing. Keep the file for memory." };
  }
  if (!deal.ownerQuestions) {
    return {
      stageLabel: "Step 1A — Owner Questions",
      needToDo:
        deal.researchStatus === "running"
          ? "Nothing yet. The Command Center is answering the Owner Questions first."
          : "Run the mandatory Owner Questions before the normal Pre-NDA screen.",
    };
  }
  if (deal.researchStatus === "pending" || deal.researchStatus === "running" || deal.status === "imported" || deal.status === "screening") {
    return {
      stageLabel: "Step 1B — Normal listing / public financial screen",
      needToDo:
        deal.researchStatus === "running"
          ? "Nothing yet. AI is researching the company."
          : "Start screening, or wait for the research queue.",
    };
  }
  if (deal.status === "screened") {
    if (deal.screening?.decision === "REQUEST_NDA") {
      return {
        stageLabel: "Step 1B — First NDA decision",
        needToDo: "Review the one-page summary, then request the NDA or pass.",
        nextButton: { label: "Request NDA", action: "nda" },
      };
    }
    if (deal.screening?.decision === "MAYBE") {
      return {
        stageLabel: "Step 1B — Need one or two answers first",
        needToDo: "Get the missing fact (usually earnings or a plain-English description), then decide.",
        nextButton: { label: "Request NDA anyway", action: "nda" },
      };
    }
    return {
      stageLabel: "Step 1B — Recommendation is PASS",
      needToDo: "Confirm pass so we do not keep seeing this card.",
      nextButton: { label: "Pass", action: "pass" },
    };
  }
  if (deal.status === "nda_requested" || deal.status === "waiting_packet") {
    return {
      stageLabel: "Stage 2 of 3 — Waiting on the information packet",
      needToDo: "Send the NDA, then upload the CIM / P&Ls when they arrive.",
      nextButton: { label: "Mark waiting for packet", action: "wait_packet" },
    };
  }
  if (deal.status === "packet_review") {
    return {
      stageLabel: "Stage 2 of 3 — Is this good enough for an LOI?",
      needToDo: deal.packet ? "Read the packet score and either advance, ask questions, renegotiate, or pass." : "Upload the packet and run the second filter.",
      nextButton: { label: "Advance to diligence", action: "diligence" },
    };
  }
  if (deal.status === "diligence") {
    return {
      stageLabel: "Stage 3 of 3 — Full due diligence",
      needToDo: "Upload tax returns and the rest. The system will score buy / pass. Fatal risks override a high score.",
      nextButton: { label: "Move to LOI", action: "loi" },
    };
  }
  if (deal.status === "loi") {
    return {
      stageLabel: "LOI / negotiation",
      needToDo: "Lock price, exclusivity, and customer-call rights. Then financing.",
      nextButton: { label: "Move to financing", action: "financing" },
    };
  }
  if (deal.status === "financing") {
    return {
      stageLabel: "Financing",
      needToDo: "Confirm DSCR, equity, and seller note with Angela / the lender.",
      nextButton: { label: "Move to closing", action: "closing" },
    };
  }
  if (deal.status === "closing") {
    return {
      stageLabel: "Closing",
      needToDo: "Attorney-led close. After funds, mark acquired.",
      nextButton: { label: "Mark acquired", action: "acquired" },
    };
  }
  return { stageLabel: "Acquired", needToDo: "100-day plan. Keep the existing business safe." };
}

export function researchProgress(store: Store) {
  const total = store.deals.length;
  const done = store.deals.filter(
    (d) => d.researchStatus === "complete" && d.ownerQuestions?.status === "complete"
  ).length;
  const running = store.deals.filter((d) => d.researchStatus === "running").length;
  const pending = store.deals.filter(
    (d) => d.researchStatus === "pending" || !d.ownerQuestions
  ).length;
  return { total, done, running, pending };
}
