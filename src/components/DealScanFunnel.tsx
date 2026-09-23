import type { Deal } from "@/lib/types";
import { companyScan } from "@/lib/company-scan";

export function DealScanFunnel({ deal }: { deal: Deal }) {
  const scan = companyScan(deal);
  return (
    <section className="card rounded-2xl p-5">
      <ol className="grid grid-cols-5 gap-2">
        {scan.funnelSteps.map((step) => {
          const current = step.key === scan.funnelStep;
          return (
            <li
              key={step.key}
              className={`rounded-xl px-2 py-3 text-center ${
                current
                  ? "bg-[var(--navy)] text-[#f7f1e4]"
                  : "bg-[var(--paper)] text-[var(--muted)]"
              }`}
            >
              <div className="text-[10px] font-semibold tracking-widest">
                {step.key}
              </div>
              <div className={`mt-1 text-xs font-semibold ${current ? "text-white" : ""}`}>
                {step.scanLabel}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm">{scan.nextAction}</p>
    </section>
  );
}
