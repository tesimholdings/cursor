import type { EvidenceKind, TrafficLight } from "@/lib/types";

const LABEL: Record<EvidenceKind, string> = {
  VERIFIED: "Verified",
  SELLER_PROVIDED: "Seller provided / unverified",
  AI_CALCULATION: "AI calculation",
  ASSUMPTION: "Assumption",
  NOT_PROVIDED: "Not provided",
  CONFLICT: "Conflict",
  ESTIMATE: "Estimate",
  EXTERNAL_RESEARCH: "External research",
};

const TONE: Record<EvidenceKind, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-900",
  SELLER_PROVIDED: "bg-amber-100 text-amber-900",
  AI_CALCULATION: "bg-sky-100 text-sky-900",
  ASSUMPTION: "bg-stone-200 text-stone-800",
  NOT_PROVIDED: "bg-stone-100 text-stone-600 border border-dashed border-stone-300",
  CONFLICT: "bg-red-100 text-red-900",
  ESTIMATE: "bg-orange-100 text-orange-900",
  EXTERNAL_RESEARCH: "bg-indigo-100 text-indigo-900",
};

export function EvidenceBadge({ kind }: { kind: EvidenceKind }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE[kind]}`}>
      {LABEL[kind]}
    </span>
  );
}

export function TrafficDot({ light }: { light: TrafficLight }) {
  const map = {
    green: "bg-[var(--green)]",
    yellow: "bg-[var(--yellow)]",
    red: "bg-[var(--red)]",
    critical: "bg-black",
  };
  const label = { green: "Looks good", yellow: "Need more information", red: "Concern", critical: "Potential deal killer" };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
      <span className={`h-2.5 w-2.5 rounded-full ${map[light]}`} />
      {label[light]}
    </span>
  );
}
