"use client";

import { useEffect, useMemo, useState } from "react";
import type { Deal } from "@/lib/types";
import { DealCard } from "@/components/DealCard";
import {
  brokerCall,
  brokerScreen,
  dealFunnelStep,
  FUNNEL_STEPS,
} from "@/lib/pipeline";
import {
  BUSINESS_CATEGORIES,
  CLOSE_SPEEDS,
  OPERATING_STYLES,
  classifyDeal,
  dealMatchesSearch,
  isHiddenSample,
} from "@/lib/classification";
import { closeSpeedFor } from "@/lib/close-speed";
import { ScoreLegend } from "@/components/ScoreLegend";
import {
  BOARD_SCORE_METRICS,
  boardScoreValue,
  dealBoardCategory,
  dealInAskRange,
  dealInPriceBand,
  parseAskMillions,
  sortBrokerBoard,
  type BoardScoreMetric,
  type BoardSort,
  type HeadlineSort,
  type PriceBand,
} from "@/lib/board-scoring";

type Persistence = { durable: boolean; note: string; error?: string };

export default function RankingPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [persistence, setPersistence] = useState<Persistence | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);
  const [bestOnly, setBestOnly] = useState(false);
  const [boardSort, setBoardSort] = useState<BoardSort>("best");
  const [priceBand, setPriceBand] = useState<PriceBand>("all");
  const [askMin, setAskMin] = useState("");
  const [askMax, setAskMax] = useState("");
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
    closeSpeed: "all",
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
    let list = deals.filter((deal) => !isHiddenSample(deal));
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
    if (filters.closeSpeed !== "all") {
      list = list.filter(
        (deal) =>
          (deal.closeSpeed || closeSpeedFor(deal)) === filters.closeSpeed
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
    if (priceBand !== "all") {
      list = list.filter((deal) => dealInPriceBand(deal, priceBand));
    }
    const minAsk = parseAskMillions(askMin);
    const maxAsk = parseAskMillions(askMax);
    if (minAsk != null || maxAsk != null) {
      list = list.filter((deal) => dealInAskRange(deal, minAsk, maxAsk));
    }
    return sortBrokerBoard(list, boardSort);
  }, [
    deals,
    bestOnly,
    filters,
    query,
    scoreMetric,
    minimumScore,
    boardSort,
    priceBand,
    askMin,
    askMax,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">Stefan’s broker screen</div>
          <h1 className="serif text-4xl">Which listings deserve an NDA?</h1>
          <p className="mt-2 text-[var(--muted)]">
            Sort by the headline on the card — weighted IC score when a Full
            IC exists, otherwise the purchase-value Board score — by asking
            price, by date added, or by business category. Each card is four
            lines: what it does, cash, the ugly, and the call plus score.
            Fast / Mid / Slow is close speed, not a quality rank.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex rounded-full border border-[var(--line)] bg-white p-1"
            role="group"
            aria-label="Sort deals by headline score"
          >
            {(
              [
                ["best", "Best first"],
                ["worst", "Worst first"],
              ] as const satisfies Array<[HeadlineSort, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  boardSort === value
                    ? "bg-[var(--navy)] text-[#f7f1e4]"
                    : "text-[var(--ink)]"
                }`}
                aria-pressed={boardSort === value}
                onClick={() => setBoardSort(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="inline-flex rounded-full border border-[var(--line)] bg-white p-1"
            role="group"
            aria-label="Sort deals by asking price"
          >
            {(
              [
                ["price-low", "Price low→high"],
                ["price-high", "Price high→low"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  boardSort === value
                    ? "bg-[var(--navy)] text-[#f7f1e4]"
                    : "text-[var(--ink)]"
                }`}
                aria-pressed={boardSort === value}
                onClick={() => setBoardSort(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="inline-flex rounded-full border border-[var(--line)] bg-white p-1"
            role="group"
            aria-label="Sort deals by date added or category"
          >
            {(
              [
                ["recent", "Newest"],
                ["category", "By category"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  boardSort === value
                    ? "bg-[var(--navy)] text-[#f7f1e4]"
                    : "text-[var(--ink)]"
                }`}
                aria-pressed={boardSort === value}
                onClick={() => setBoardSort(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            Category
            <select
              aria-label="Business category"
              className="rounded-lg border border-[var(--line)] bg-white px-2 py-2 font-normal"
              value={filters.category}
              onChange={(event) =>
                setFilters({ ...filters, category: event.target.value })
              }
            >
              <option value="all">All categories</option>
              {BUSINESS_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
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
            placeholder="Company, industry, category, location, broker, source, hands-off, or slow close…"
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
          operating-style tags, and Fast / Mid / Slow close-speed tags as you
          type.
        </p>
        <ScoreLegend className="mt-3" />
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
          aria-label="Asking price band"
          className="rounded-lg border border-[var(--line)] bg-white px-2 py-1"
          value={priceBand}
          onChange={(event) =>
            setPriceBand(event.target.value as PriceBand)
          }
        >
          <option value="all">All asking prices</option>
          <option value="under5">Under $5M</option>
          <option value="box">$5–10M</option>
          <option value="over10">Over $10M</option>
        </select>
        <label className="flex items-center gap-2">
          Ask min $M
          <input
            aria-label="Minimum asking price in millions"
            type="number"
            min="0"
            step="0.1"
            inputMode="decimal"
            placeholder="—"
            className="w-20 rounded-lg border border-[var(--line)] bg-white px-2 py-1"
            value={askMin}
            onChange={(event) => setAskMin(event.target.value)}
          />
        </label>
        <label className="flex items-center gap-2">
          Ask max $M
          <input
            aria-label="Maximum asking price in millions"
            type="number"
            min="0"
            step="0.1"
            inputMode="decimal"
            placeholder="—"
            className="w-20 rounded-lg border border-[var(--line)] bg-white px-2 py-1"
            value={askMax}
            onChange={(event) => setAskMax(event.target.value)}
          />
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
          aria-label="Business category filter"
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
          value={filters.closeSpeed}
          onChange={(event) =>
            setFilters({ ...filters, closeSpeed: event.target.value })
          }
        >
          <option value="all">All close speeds</option>
          {CLOSE_SPEEDS.map((speed) => (
            <option key={speed} value={speed}>
              {speed} close
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
        {boardSort === "best"
          ? "best first by headline"
          : boardSort === "worst"
            ? "worst first by headline"
            : boardSort === "price-high"
              ? "ask high to low"
              : boardSort === "price-low"
                ? "ask low to high"
                : boardSort === "recent"
                  ? "newest first by date added"
                  : "grouped by business category"}
        . Search and filters apply first. Deals with no ask sit last on Price
        sort. Deals with no added date sit last on Newest. Unknown categories
        sit last on By category.
      </p>

      <div className="grid gap-3 md:grid-cols-2" hidden={Boolean(failure)}>
        {ranked.length === 0 && (
          <p className="text-sm text-[var(--muted)] md:col-span-2">
            {query.trim()
              ? `No companies match ‘${query.trim()}’.`
              : "No companies match the current filters."}
          </p>
        )}
        {ranked.map((deal, index) => (
          <DealCard
            key={deal.id}
            deal={deal}
            rank={index + 1}
            category={
              boardSort === "category" ? dealBoardCategory(deal) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
