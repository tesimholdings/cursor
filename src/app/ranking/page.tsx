"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Deal } from "@/lib/types";
import { money, multiple } from "@/lib/format";
import {
  brokerCall,
  brokerScreen,
  dealFunnelStep,
  FUNNEL_STEPS,
  type BrokerCall,
} from "@/lib/pipeline";

export default function RankingPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [researching, setResearching] = useState(false);
  const [bestOnly, setBestOnly] = useState(false);
  const [filters, setFilters] = useState({
    call: "all",
    industry: "",
    state: "",
    step: "all",
  });

  useEffect(() => {
    let cancelled = false;
    async function loadAndRunQueue() {
      setResearching(true);
      try {
        for (;;) {
          const response = await fetch("/api/deals", { cache: "no-store" });
          const payload = await response.json();
          if (cancelled) return;
          setDeals(payload.deals || []);
          if (!payload.research?.pending) return;
          const research = await fetch("/api/research", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ limit: 4 }),
          });
          const result = await research.json();
          if (!result.processed?.length) return;
        }
      } finally {
        if (!cancelled) setResearching(false);
      }
    }
    void loadAndRunQueue();
    return () => {
      cancelled = true;
    };
  }, []);

  const ranked = useMemo(() => {
    let list = [...deals];
    if (bestOnly) {
      list = list.filter(
        (deal) =>
          brokerCall(deal) === "INQUIRE + NDA" &&
          (brokerScreen(deal).score || 0) >= 68
      );
    }
    if (filters.call !== "all") {
      list = list.filter((deal) => brokerCall(deal) === filters.call);
    }
    if (filters.industry) {
      list = list.filter((deal) =>
        deal.industry.toLowerCase().includes(filters.industry.toLowerCase())
      );
    }
    if (filters.state) {
      list = list.filter((deal) =>
        (deal.state || deal.location).includes(filters.state)
      );
    }
    if (filters.step !== "all") {
      list = list.filter(
        (deal) => dealFunnelStep(deal) === Number(filters.step)
      );
    }
    return list.sort(
      (a, b) => (brokerScreen(b).score || 0) - (brokerScreen(a).score || 0)
    );
  }, [deals, bestOnly, filters]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">Stefan’s broker screen</div>
          <h1 className="serif text-4xl">Which listings deserve an NDA?</h1>
          <p className="mt-2 text-[var(--muted)]">
            Scan the original pre-NDA score and Good / Bad / Ugly before
            spending time with the broker.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {researching && (
            <span className="text-sm text-[var(--muted)]">
              Screening imported rows…
            </span>
          )}
          <button
            className="btn btn-gold"
            onClick={() => setBestOnly((value) => !value)}
          >
            {bestOnly ? "Show all deals" : "Show me only the best deals"}
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap gap-3 rounded-2xl p-4 text-sm">
        <select
          className="rounded-lg border border-[var(--line)] bg-white px-2 py-1"
          value={filters.call}
          onChange={(event) =>
            setFilters({ ...filters, call: event.target.value })
          }
        >
          <option value="all">All broker calls</option>
          <option value="INQUIRE + NDA">Inquire + NDA</option>
          <option value="NEED MORE">Need more</option>
          <option value="PASS">Pass</option>
        </select>
        <select
          className="rounded-lg border border-[var(--line)] bg-white px-2 py-1"
          value={filters.step}
          onChange={(event) =>
            setFilters({ ...filters, step: event.target.value })
          }
        >
          <option value="all">All funnel steps</option>
          {FUNNEL_STEPS.map((step) => (
            <option key={step.key} value={step.key}>
              {step.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Industry"
          className="rounded-lg border border-[var(--line)] px-2 py-1"
          value={filters.industry}
          onChange={(event) =>
            setFilters({ ...filters, industry: event.target.value })
          }
        />
        <input
          placeholder="State"
          className="w-24 rounded-lg border border-[var(--line)] px-2 py-1"
          value={filters.state}
          onChange={(event) =>
            setFilters({ ...filters, state: event.target.value })
          }
        />
      </div>

      <div className="card overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[1320px] text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              {[
                "Rank",
                "Company",
                "Step",
                "Screen",
                "Good",
                "Bad",
                "Ugly",
                "Broker call",
                "Ask",
                "Revenue",
                "SDE / EBITDA",
                "Multiple",
              ].map((heading) => (
                <th key={heading} className="px-3 py-3 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map((deal, index) => {
              const earnings = deal.sde || deal.ebitda;
              const askingMultiple = multiple(deal.askingPrice, earnings);
              const screen = brokerScreen(deal);
              const step = FUNNEL_STEPS.find(
                (item) => item.key === screen.step
              );
              return (
                <tr
                  key={deal.id}
                  className="border-b border-[var(--line)] align-top last:border-0"
                >
                  <td className="px-3 py-4">{index + 1}</td>
                  <td className="px-3 py-4">
                    <Link
                      className="font-semibold underline-offset-2 hover:underline"
                      href={`/deals/${deal.id}`}
                    >
                      {deal.name}
                    </Link>
                    <div className="text-xs text-[var(--muted)]">
                      {deal.industry} · {deal.location}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <span className="font-semibold">{step?.key}</span>
                    <div className="max-w-28 text-xs text-[var(--muted)]">
                      {step?.shortLabel}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <span className="serif text-2xl">
                      {screen.score ?? "—"}
                    </span>
                    <span className="text-xs text-[var(--muted)]"> / 100</span>
                  </td>
                  <ScreenBullet tone="good" text={screen.good} />
                  <ScreenBullet tone="bad" text={screen.bad} />
                  <ScreenBullet tone="ugly" text={screen.ugly} />
                  <td className="px-3 py-4">
                    <BrokerBadge call={screen.call} />
                  </td>
                  <td className="px-3 py-4">{money(deal.askingPrice)}</td>
                  <td className="px-3 py-4">{money(deal.revenue)}</td>
                  <td className="px-3 py-4">{money(earnings)}</td>
                  <td className="px-3 py-4">
                    {askingMultiple ? `${askingMultiple.toFixed(1)}x` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScreenBullet({
  tone,
  text,
}: {
  tone: "good" | "bad" | "ugly";
  text: string;
}) {
  const styles = {
    good: "bg-emerald-100 text-emerald-900",
    bad: "bg-amber-100 text-amber-950",
    ugly: "bg-stone-900 text-white",
  };
  return (
    <td className="px-3 py-4">
      <div className={`max-w-52 rounded-lg p-2 text-xs ${styles[tone]}`}>
        {text}
      </div>
    </td>
  );
}

function BrokerBadge({ call }: { call: BrokerCall }) {
  const styles: Record<BrokerCall, string> = {
    "INQUIRE + NDA": "bg-emerald-700 text-white",
    "NEED MORE": "bg-amber-400 text-stone-950",
    PASS: "bg-stone-900 text-white",
  };
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${styles[call]}`}
    >
      {call}
    </span>
  );
}
