import type { Deal } from "@/lib/types";
import { companyScan } from "@/lib/company-scan";

const CALL_TONE: Record<string, string> = {
  PASS: "bg-red-100 text-red-900",
  CONTINUE: "bg-[var(--navy)] text-[#f7f1e4]",
  RENEGOTIATE: "bg-amber-100 text-amber-950",
  BUY: "bg-emerald-100 text-emerald-950",
};

const CLOSE_TONE: Record<string, string> = {
  Fast: "bg-teal-100 text-teal-950",
  Mid: "bg-slate-100 text-slate-800",
  Slow: "bg-rose-100 text-rose-950",
};

export function DealHeader({ deal }: { deal: Deal }) {
  const scan = companyScan(deal);
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="serif text-4xl leading-tight">{scan.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold tracking-wide ${CALL_TONE[scan.call]}`}
          >
            {scan.call}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${CLOSE_TONE[scan.closeSpeed]}`}
          >
            {scan.closeSpeed} close
          </span>
          {scan.ask ? (
            <span className="text-sm font-semibold">Ask {scan.ask}</span>
          ) : null}
        </div>
      </div>
      <div className="text-right">
        <div className="serif text-5xl leading-none">{scan.score}</div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {scan.scoreLabel}
        </div>
      </div>
    </header>
  );
}
