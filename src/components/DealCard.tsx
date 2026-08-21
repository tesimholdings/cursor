import type { Deal } from "@/lib/types";
import { money, multiple } from "@/lib/format";
import { ScoreRing } from "./ScoreRing";
import Link from "next/link";
import { brokerCall, dealFunnelStep, FUNNEL_STEPS } from "@/lib/pipeline";
import { DealScanPills } from "./DealScanPills";
import { BoardScoreStrip } from "./BoardScores";
import { headlineScore } from "@/lib/board-scoring";

export function DealCard({ deal }: { deal: Deal }) {
  const earn = deal.sde || deal.ebitda;
  const mult = multiple(deal.askingPrice, earn);
  const rec = deal.diligence?.finalDecision || deal.packet?.decision || deal.screening?.decision;
  const step = FUNNEL_STEPS.find((item) => item.key === dealFunnelStep(deal));
  const headline = headlineScore(deal);
  return (
    <Link href={`/deals/${deal.id}`} className="card block rounded-2xl p-4 hover:border-[var(--navy)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="kicker">
            Step {step?.key} · {step?.shortLabel}
          </div>
          <div className="serif text-lg leading-tight">{deal.name}</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {deal.industry} · {deal.location}
          </div>
        </div>
        <div className="text-center">
          <ScoreRing
            score={headline.score}
            size={56}
          />
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {headline.label}
          </div>
          {headline.label === "IC score" && (
            <div className="text-[10px] text-[var(--muted)]">
              Average {headline.boardAverage}
            </div>
          )}
        </div>
      </div>
      <DealScanPills deal={deal} className="mt-3" />
      <BoardScoreStrip deal={deal} className="mt-3" />
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-[11px] text-[var(--muted)]">Asking</dt>
          <dd className="font-semibold">{money(deal.askingPrice)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-[var(--muted)]">Revenue</dt>
          <dd className="font-semibold">{money(deal.revenue)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-[var(--muted)]">SDE / EBITDA</dt>
          <dd className="font-semibold">{money(earn)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-[var(--muted)]">Multiple</dt>
          <dd className="font-semibold">{mult ? `${mult.toFixed(1)}x` : "—"}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full bg-[var(--brass)] px-2 py-0.5 font-semibold">
          {brokerCall(deal)}
        </span>
        <span className="rounded-full bg-[var(--paper-2)] px-2 py-0.5">
          RE {deal.realEstateIncluded ? "included" : deal.realEstateIncluded === false ? "no" : "?"}
        </span>
        {rec && (
          <span className="rounded-full bg-[var(--navy)] px-2 py-0.5 text-[#f7f1e4]">
            {String(rec).replace(/_/g, " ")}
          </span>
        )}
      </div>
    </Link>
  );
}
