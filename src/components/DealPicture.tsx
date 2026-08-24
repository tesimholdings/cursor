import type { Deal, DealPictureFact } from "@/lib/types";
import { companyScan } from "@/lib/company-scan";

export function DealPicturePanel({ deal }: { deal: Deal }) {
  const scan = companyScan(deal);
  return (
    <section className="card rounded-2xl p-5">
      <div className="kicker">Deal picture</div>
      {scan.summary ? (
        <p className="mt-2 max-w-3xl text-base leading-6">{scan.summary}</p>
      ) : (
        <p className="mt-2 text-sm text-[var(--muted)]">No readable shop summary on this card.</p>
      )}
      {scan.facts.length > 0 && (
        <table className="mt-4 w-full max-w-xl text-sm">
          <tbody>
            {scan.facts.map((item) => (
              <FactRow key={item.label} fact={item} />
            ))}
          </tbody>
        </table>
      )}
      {scan.ugly ? (
        <p className="mt-4 text-sm font-semibold">Ugly: {scan.ugly}</p>
      ) : null}
      {scan.callLine && scan.callLine !== scan.call ? (
        <p className="mt-3 text-sm font-semibold">{scan.callLine}</p>
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
        : "text-[var(--ink)]";
  const kindLabel =
    fact.kind === "SELLER_CLAIM"
      ? "Seller Claim"
      : fact.kind === "CIM_FACT"
        ? "CIM"
        : fact.kind.replace(/_/g, " ");
  return (
    <tr className="border-t border-[var(--line)]">
      <th className="w-36 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {fact.label}
      </th>
      <td className={`py-2 font-semibold ${tone}`}>{fact.value}</td>
      <td className="py-2 text-right text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {kindLabel}
      </td>
    </tr>
  );
}
