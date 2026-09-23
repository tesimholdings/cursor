import type { Deal } from "@/lib/types";
import { boardCardLines } from "@/lib/board-card";

export function DealPicturePanel({ deal }: { deal: Deal }) {
  const lines = boardCardLines(deal);
  return (
    <section className="card rounded-2xl p-5">
      <div className="kicker">Deal picture</div>
      <div className="mt-2 max-w-3xl space-y-1 text-base leading-6">
        <p>{lines.what}</p>
        <p className="font-semibold">{lines.cash}</p>
        <p>{lines.ugly}</p>
        <p className="font-semibold">{lines.call}</p>
      </div>
    </section>
  );
}
