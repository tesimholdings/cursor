import type { Deal, DealPictureFact } from "@/lib/types";
import { buildDealPicture, hasReadableCim, visibleDealPictureFacts } from "@/lib/deal-picture";
import { brokerCall } from "@/lib/pipeline";

export function DealPicturePanel({ deal }: { deal: Deal }) {
  const picture = deal.dealPicture || buildDealPicture(deal);
  const cim = hasReadableCim(deal) || picture.status === "from_cim";
  const facts = visibleDealPictureFacts(picture.facts);
  const call = deal.diligence?.finalDecision || brokerCall(deal);
  return (
    <section className="card rounded-2xl p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker">{cim ? "From the CIM" : "Listing screen"}</div>
          <h2 className="serif text-2xl">Deal picture</h2>
        </div>
        <div className="text-right text-sm font-semibold">
          <div>
            {call} · {picture.scoreLabel} {picture.score}
          </div>
          <div className="text-xs font-medium text-[var(--muted)]">
            {picture.closeSpeed} close
          </div>
        </div>
      </div>
      {picture.summary ? (
        <p className="mt-3 max-w-3xl text-sm leading-6">{picture.summary}</p>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">CIM text not parsed.</p>
      )}
      {facts.length > 0 && (
        <table className="mt-4 w-full max-w-xl text-sm">
          <tbody>
            {facts.map((item) => (
              <FactRow key={item.label} fact={item} />
            ))}
          </tbody>
        </table>
      )}
      {picture.ugly ? (
        <p className="mt-4 text-sm font-semibold">{picture.ugly}</p>
      ) : null}
    </section>
  );
}

function FactRow({ fact }: { fact: DealPictureFact }) {
  const tone =
    fact.kind === "CIM_FACT"
      ? "text-emerald-900"
      : fact.kind === "SELLER_CLAIM"
        ? "text-amber-950"
        : "text-[var(--muted)]";
  return (
    <tr className="border-t border-[var(--line)]">
      <th className="w-36 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {fact.label}
      </th>
      <td className={`py-2 font-semibold ${tone}`}>{fact.value}</td>
      <td className="py-2 text-right text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {fact.kind.replace(/_/g, " ")}
      </td>
    </tr>
  );
}
