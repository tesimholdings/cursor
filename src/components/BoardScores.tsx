import { boardScoresFor, headlineScore } from "@/lib/board-scoring";
import type { Deal } from "@/lib/types";

const SUB_KEYS = [
  { key: "financials", label: "Financials" },
  { key: "owner", label: "Owner" },
  { key: "growth", label: "Growth" },
  { key: "handsOff", label: "Hands-off" },
  { key: "safety", label: "Safety" },
  { key: "assets", label: "Assets" },
] as const;

export function BoardScoreStrip({
  deal,
  className = "",
}: {
  deal: Deal;
  className?: string;
}) {
  const scores = boardScoresFor(deal);
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-1 text-[11px] ${className}`}>
      {SUB_KEYS.map((metric) => (
        <span key={metric.key}>
          <span className="text-[var(--muted)]">{metric.label}</span>{" "}
          <strong>{scores[metric.key].score}</strong>
        </span>
      ))}
    </div>
  );
}

export function BoardScorePanel({ deal }: { deal: Deal }) {
  const scores = boardScoresFor(deal);
  const headline = headlineScore(deal);
  return (
    <section className="card rounded-2xl p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker">Listing-level decision score</div>
          <h2 className="serif text-2xl">Board average</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Equal weight across the six sub-scores. Unknown evidence is scored
            conservatively.
          </p>
        </div>
        <div className="text-right">
          <div className="serif text-4xl">
            {scores.average}
            <span className="text-sm text-[var(--muted)]"> / 100</span>
          </div>
          {headline.label === "IC score" && (
            <div className="text-sm font-semibold">
              IC score {headline.score} / 100 is the current headline
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {SUB_KEYS.map((metric) => {
          const item = scores[metric.key];
          return (
            <details
              key={metric.key}
              className="rounded-xl bg-[var(--paper)] p-3"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{metric.label}</span>
                  <span className="serif text-xl">{item.score}</span>
                </div>
                {item.unknown && (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Unknown evidence
                  </span>
                )}
              </summary>
              <p className="mt-2 text-xs text-[var(--muted)]">{item.why}</p>
            </details>
          );
        })}
      </div>
    </section>
  );
}
