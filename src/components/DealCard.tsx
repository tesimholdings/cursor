import type { Deal } from "@/lib/types";
import Link from "next/link";
import { boardCardLines } from "@/lib/board-card";

const CLOSE_TONE = {
  Fast: "bg-teal-100 text-teal-950",
  Mid: "bg-slate-100 text-slate-800",
  Slow: "bg-rose-100 text-rose-950",
} as const;

export function DealCard({
  deal,
  rank,
  category,
}: {
  deal: Deal;
  rank?: number;
  category?: string;
}) {
  const lines = boardCardLines(deal);
  return (
    <article className="card rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {(rank != null || category) && (
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {rank != null ? rank : ""}
              {rank != null && category ? " · " : ""}
              {category || ""}
            </div>
          )}
          <Link
            href={`/deals/${deal.id}`}
            className="serif text-lg leading-tight hover:underline"
          >
            {deal.name}
          </Link>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CLOSE_TONE[lines.closeSpeed]}`}
        >
          {lines.closeSpeed} close
        </span>
      </div>
      <div className="mt-3 space-y-1 text-sm leading-5">
        <p>{lines.what}</p>
        <p className="font-semibold">{lines.cash}</p>
        <p>{lines.ugly}</p>
        <p className="font-semibold">{lines.call}</p>
      </div>
      {lines.openCimUrl ? (
        <a
          className="btn btn-primary mt-3"
          href={lines.openCimUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open CIM
        </a>
      ) : null}
    </article>
  );
}
