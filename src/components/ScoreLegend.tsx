export function ScoreLegend({ className = "" }: { className?: string }) {
  return (
    <details className={`text-xs text-[var(--muted)] ${className}`}>
      <summary className="cursor-pointer font-semibold text-[var(--ink)]">
        How purchase value and close speed are scored
      </summary>
      <div className="mt-2 max-w-3xl space-y-2 leading-5">
        <p>
          The Board headline is a purchase-value mix, not an equal average.
          Cash and downside outrank style: Financials 30, Assets 20, Owner 15,
          Safety 15, Hands-off 10, Growth 10. Missing subs are dropped and the
          rest are renormalized. Equal-weight is kept only as a small legacy
          check — it is not the sort key.
        </p>
        <p>
          Industry mix used here: Search Fund Market’s typical target weights
          (recurring revenue, concentration, EBITDA stability, defensibility,
          management, capex, valuation, fragmentation, seller motivation,
          growth levers); Dealmaker’s Financial 50 / Operational 30 / Strategic
          20 with cash-flow as a veto; Glacier Lake’s finding that revenue
          quality drives the multiple in most LMM deals and that &gt;25–30%
          concentration haircuts price or structure; and Search Fund Market
          valuation notes that recast/add-backs are not verified earnings.
          TESIM still prefers cash-flowing, asset-heavy, semi-absentee-capable
          operators. Tax never saves a bad company, so it stays a small IC
          pillar (5).
        </p>
        <p>
          Full IC, when present, is the card headline. Pillars are reweighted
          to Financial 25, Customer / revenue 20, Operations 15, Asset /
          downside 12, Deal structure 10, Growth 8, Tax 5, Legal / reg / env 5.
          An open UTC/gov complaint, top customer &gt;30% Seller Claim, or
          non-transferring cert can still force PASS. Fatal-risk override is
          unchanged.
        </p>
        <p>
          Fast / Mid / Slow is time-to-close after a serious LOI, not quality.
          Fast ~45–60 days (clean books, no/simple RE, no Phase II, no license
          transfer, asset sale). Mid ~60–90 days (typical CIM + QoE + bank/SBA).
          Slow 90–180+ days (Phase I/II, government novation, set-asides,
          franchise, customer-owned tooling, open legal/UTC, construction WIP,
          multi-site RE). Sources: GoSBA, CT Acquisitions, Regalis, and
          government-contractor novation practice.
        </p>
      </div>
    </details>
  );
}
