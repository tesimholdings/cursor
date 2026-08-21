"use client";

import { useEffect, useState } from "react";
import { Funnel } from "@/components/Funnel";
import { DealCard } from "@/components/DealCard";
import { dealFunnelStep, PIPELINE_COLUMNS } from "@/lib/pipeline";
import type { Deal, Store } from "@/lib/types";
import Link from "next/link";
import { Play } from "lucide-react";

type Payload = Store & {
  funnel: { label: string; value: number }[];
  research: { total: number; done: number; running: number; pending: number };
  persistence?: { durable: boolean; note: string };
};

export function DashboardClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/deals", { cache: "no-store" });
    setData(await res.json());
  }

  useEffect(() => {
    // Data is loaded from the persisted server store; this effect is the
    // external-system synchronization boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  async function runQueue() {
    setBusy(true);
    try {
      let pending = true;
      while (pending) {
        const res = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 4 }),
        });
        const json = await res.json();
        pending = json.pending > 0;
        await load();
        if (!json.processed?.length) break;
      }
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="text-[var(--muted)]">Loading the pipeline…</p>;

  const byCol = PIPELINE_COLUMNS.map((col) => ({
    ...col,
    deals: data.deals.filter((deal) => dealFunnelStep(deal) === col.key),
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">Don’t worry about everything yet</div>
          <h1 className="serif text-4xl">Here is the next decision.</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Sort hundreds of businesses, request NDAs only for the ones that deserve them, then decide
            buy, continue, renegotiate, or pass — in plain English.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/ranking" className="btn btn-primary">
            Open broker board
          </Link>
          <Link href="/upload" className="btn btn-ghost">
            Add companies
          </Link>
          <button className="btn btn-ghost" onClick={runQueue} disabled={busy}>
            <Play size={14} />
            {busy ? "Screening…" : `Screen remaining (${data.research.pending})`}
          </button>
        </div>
      </div>

      {data.persistence && !data.persistence.durable && (
        <div className="rounded-2xl bg-amber-100 px-5 py-3 text-sm text-amber-950">
          <strong>Preview storage.</strong> {data.persistence.note}
        </div>
      )}

      <div className="card rounded-2xl px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            <span className="serif text-2xl">
              {data.research.done} / {data.research.total}
            </span>{" "}
            <span className="text-[var(--muted)]">researched</span>
          </p>
          <p className="text-sm text-[var(--muted)]">
            You can leave and come back. Findings are saved. Research is not repeated unless you ask.
          </p>
        </div>
      </div>

      <Funnel steps={data.funnel} />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {byCol.map((col) => (
          <section key={col.key} className="w-72 shrink-0">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">{col.label}</h2>
              <span className="text-xs text-[var(--muted)]">{col.deals.length}</span>
            </div>
            <div className="space-y-3">
              {col.deals.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
                  Empty
                </div>
              )}
              {col.deals.map((d: Deal) => (
                <DealCard key={d.id} deal={d} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
