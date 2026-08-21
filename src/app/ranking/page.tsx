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
import {
  BUSINESS_CATEGORIES,
  OPERATING_STYLES,
  classifyDeal,
  dealMatchesSearch,
} from "@/lib/classification";
import { DealScanPills } from "@/components/DealScanPills";
import { BoardScoreStrip } from "@/components/BoardScores";
import {
  BOARD_SCORE_METRICS,
  boardScoreValue,
  headlineScore,
  sortDealsByHeadline,
  type BoardScoreMetric,
  type HeadlineSort,
} from "@/lib/board-scoring";

type Persistence = { durable: boolean; note: string; error?: string };

export default function RankingPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [persistence, setPersistence] = useState<Persistence | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);
  const [bestOnly, setBestOnly] = useState(false);
  const [headlineSort, setHeadlineSort] = useState<HeadlineSort>("best");
  const [query, setQuery] = useState("");
  const [scoreMetric, setScoreMetric] =
    useState<BoardScoreMetric>("average");
  const [minimumScore, setMinimumScore] = useState("all");
  const [filters, setFilters] = useState({
    call: "all",
    category: "all",
    operatingStyle: "all",
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
          setPersistence(payload.persistence || null);
          if (!response.ok || payload.storeUnavailable) {
            setFailure(
              payload.error || `The deal store returned ${response.status}.`
            );
            return;
          }
          setFailure(null);
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
    if (filters.category !== "all") {
      list = list.filter(
        (deal) =>
          (deal.businessCategory || classifyDeal(deal).businessCategory) ===
          filters.category
      );
    }
    if (filters.operatingStyle !== "all") {
      list = list.filter((deal) =>
        (
          deal.operatingStyleTags ||
          classifyDeal(deal).operatingStyleTags
        ).includes(filters.operatingStyle as "Hands-off" | "Hands-on" | "Mixed")
      );
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
    if (query.trim()) {
      list = list.filter((deal) => dealMatchesSearch(deal, query));
    }
    if (minimumScore !== "all") {
      list = list.filter(
        (deal) =>
          boardScoreValue(deal, scoreMetric) >= Number(minimumScore)
      );
    }
    return sortDealsByHeadline(list, headlineSort);
  }, [deals, bestOnly, filters, query, scoreMetric, minimumScore, headlineSort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">Stefan’s broker screen</div>
          <h1 className="serif text-4xl">Which listings deserve an NDA?</h1>
          <p className="mt-2 text-[var(--muted)]">
            Sort by the same headline already on the card — IC score when a
            Full IC exists, otherwise Board average — then scan Good / Bad /
            Interesting before spending time with the broker.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex rounded-full border border-[var(--line)] bg-white p-1"
            role="group"
            aria-label="Sort deals by headline score"
          >
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                headlineSort === "best"
                  ? "bg-[var(--navy)] text-[#f7f1e4]"
                  : "text-[var(--ink)]"
              }`}
              aria-pressed={headlineSort === "best"}
              onClick={() => setHeadlineSort("best")}
            >
              Best first
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                headlineSort === "worst"
                  ? "bg-[var(--navy)] text-[#f7f1e4]"
                  : "text-[var(--ink)]"
              }`}
              aria-pressed={headlineSort === "worst"}
              onClick={() => setHeadlineSort("worst")}
            >
              Worst first
            </button>
          </div>
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

      {failure && (
        <div className="rounded-2xl bg-red-100 px-5 py-4 text-sm text-red-950">
          <strong>The shared deal store is unreachable.</strong> The board is
          hidden because a partial list would understate the pipeline.
          <div className="mt-2 font-mono text-xs">{failure}</div>
        </div>
      )}

      {!failure && persistence && !persistence.durable && (
        <div className="rounded-2xl bg-amber-100 px-5 py-3 text-sm text-amber-950">
          <strong>Storage is not shared yet.</strong> {persistence.note}
          {persistence.error && (
            <div className="mt-2 font-mono text-xs">{persistence.error}</div>
          )}
        </div>
      )}

      <div className="card rounded-2xl p-4">
        <label
          htmlFor="deal-search"
          className="block text-sm font-semibold text-[var(--navy)]"
        >
          Search the deal board
        </label>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="deal-search"
            type="search"
            autoComplete="off"
            placeholder="Company, industry, category, location, broker, source, or hands-off…"
            className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none focus:border-[var(--navy)] focus:ring-2 focus:ring-blue-100"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setQuery("");
              }
            }}
          />
          {query && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setQuery("")}
            >
              Clear
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Searches names, industries, categories, locations, brokers, sources,
          and operating-style tags as you type.
        </p>
      </div>

      <div className="card flex flex-wrap gap-3 rounded-2xl p-4 text-sm">
        <label className="flex items-center gap-2">
          Filter score
          <select
            aria-label="Score used for the minimum filter"
            className="rounded-lg border border-[var(--line)] bg-white px-2 py-1"
            value={scoreMetric}
            onChange={(event) =>
              setScoreMetric(event.target.value as BoardScoreMetric)
            }
          >
            {BOARD_SCORE_METRICS.map((metric) => (
              <option key={metric.key} value={metric.key}>
                {metric.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Minimum
          <select
            aria-label="Minimum selected score"
            className="rounded-lg border border-[var(--line)] bg-white px-2 py-1"
            value={minimumScore}
            onChange={(event) => setMinimumScore(event.target.value)}
          >
            <option value="all">Any score</option>
            {[40, 50, 60, 70, 80].map((score) => (
              <option key={score} value={score}>
                {score}+
              </option>
            ))}
          </select>
        </label>
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
          value={filters.category}
          onChange={(event) =>
            setFilters({ ...filters, category: event.target.value })
          }
        >
          <option value="all">All business categories</option>
          {BUSINESS_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-[var(--line)] bg-white px-2 py-1"
          value={filters.operatingStyle}
          onChange={(event) =>
            setFilters({ ...filters, operatingStyle: event.target.value })
          }
        >
          <option value="all">All operating styles</option>
          {OPERATING_STYLES.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
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

      <p className="text-sm text-[var(--muted)]">
        Showing {ranked.length} of {deals.length}{" "}
        {headlineSort === "best" ? "best first" : "worst first"} by the card
        headline. Search and filters apply first.
      </p>

      <div
        className="card overflow-x-auto rounded-2xl"
        hidden={Boolean(failure)}
      >
        <table className="w-full min-w-[1450px] text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              {[
                "Rank",
                "Company",
                "Step",
                "Score",
                "Good",
                "Bad",
                "Interesting",
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
            {ranked.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className="px-6 py-12 text-center text-[var(--muted)]"
                >
                  {query.trim()
                    ? `No companies match ‘${query.trim()}’.`
                    : "No companies match the current filters."}
                </td>
              </tr>
            )}
            {ranked.map((deal, index) => {
              const earnings = deal.sde || deal.ebitda;
              const askingMultiple = multiple(deal.askingPrice, earnings);
              const screen = brokerScreen(deal);
              const headline = headlineScore(deal);
              const rank = headline.score;
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
                    <DealScanPills deal={deal} className="mt-2 max-w-64" />
                  </td>
                  <td className="px-3 py-4">
                    <span className="font-semibold">{step?.key}</span>
                    <div className="max-w-28 text-xs text-[var(--muted)]">
                      {step?.shortLabel}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <span className="serif text-2xl">
                      {Number.isFinite(rank) ? rank : "—"}
                    </span>
                    <span className="text-xs text-[var(--muted)]"> / 100</span>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {headline.label}
                    </div>
                    {headline.label === "IC score" && (
                      <div className="text-[10px] text-[var(--muted)]">
                        Average {headline.boardAverage}
                      </div>
                    )}
                    <BoardScoreStrip
                      deal={deal}
                      className="mt-2 max-w-52"
                    />
                  </td>
                  <ScreenBullet tone="good" text={screen.good} />
                  <ScreenBullet tone="bad" text={screen.bad} />
                  <ScreenBullet tone="interesting" text={screen.interesting} />
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
  tone: "good" | "bad" | "interesting";
  text: string[];
}) {
  const styles = {
    good: "bg-emerald-100 text-emerald-900",
    bad: "bg-amber-100 text-amber-950",
    interesting: "bg-blue-100 text-blue-950",
  };
  return (
    <td className="px-3 py-4">
      <ul
        className={`max-w-56 list-disc space-y-1 rounded-lg p-3 pl-6 text-xs ${styles[tone]}`}
      >
        {text.slice(0, 2).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
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
