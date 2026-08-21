import type { Deal, DealPictureFact } from "@/lib/types";
import { buildDealPicture, hasReadableCim } from "@/lib/deal-picture";

export function DealPicturePanel({ deal }: { deal: Deal }) {
  const picture = deal.dealPicture || buildDealPicture(deal);
  const cim = hasReadableCim(deal) || picture.status === "from_cim";
  return (
    <section className="card rounded-2xl p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker">{cim ? "From the CIM" : "Listing screen"}</div>
          <h2 className="serif text-2xl">Deal picture</h2>
        </div>
        <div className="text-sm font-semibold">
          {picture.scoreLabel} {picture.score} · {picture.closeSpeed} close
        </div>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-6">{picture.summary}</p>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {picture.facts.map((item) => (
          <FactCard key={item.label} fact={item} />
        ))}
      </div>
      {picture.risks.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Top risks from the file
          </div>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {picture.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
      )}
      {picture.unanswered.length > 0 && (
        <div className="mt-3 text-sm text-[var(--muted)]">
          {picture.unanswered.join(" · ")}
        </div>
      )}
    </section>
  );
}

function FactCard({ fact }: { fact: DealPictureFact }) {
  const tone =
    fact.kind === "CIM_FACT"
      ? "text-emerald-900"
      : fact.kind === "SELLER_CLAIM"
        ? "text-amber-950"
        : "text-[var(--muted)]";
  return (
    <div className="rounded-xl bg-[var(--paper)] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {fact.label}
      </div>
      <div className={`mt-1 text-sm font-semibold ${tone}`}>{fact.value}</div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {fact.kind.replace(/_/g, " ")}
      </div>
    </div>
  );
}
