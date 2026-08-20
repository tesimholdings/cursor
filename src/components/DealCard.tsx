import type { Deal } from "@/lib/types";
import { money, multiple } from "@/lib/format";
import { ScoreRing } from "./ScoreRing";
import Link from "next/link";

export function DealCard({ deal }: { deal: Deal }) {
  const earn = deal.sde || deal.ebitda;
  const mult = multiple(deal.askingPrice, earn);
  const rec = deal.diligence?.finalDecision || deal.packet?.decision || deal.screening?.decision;
  return (
    <Link href={`/deals/${deal.id}`} className="card block rounded-2xl p-4 hover:border-[var(--navy)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="kicker">{deal.status.replace("_", " ")}</div>
          <div className="serif text-lg leading-tight">{deal.name}</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {deal.industry} · {deal.location}
          </div>
        </div>
        {deal.screening && <ScoreRing score={deal.diligence?.scores.total || deal.packet?.score || deal.screening.preNdaScore} size={56} />}
      </div>
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
