"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Deal } from "@/lib/types";
import { money, multiple } from "@/lib/format";

export default function RankingPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [bestOnly, setBestOnly] = useState(false);
  const [filters, setFilters] = useState({
    decision: "all",
    industry: "",
    state: "",
    re: "all",
    sf: "all",
  });

  useEffect(() => {
    fetch("/api/deals", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setDeals(j.deals || []));
  }, []);

  const ranked = useMemo(() => {
    let list = [...deals];
    if (bestOnly) {
      list = list.filter(
        (d) => d.screening?.decision === "REQUEST_NDA" && (d.screening?.preNdaScore || 0) >= 68
      );
    }
    if (filters.decision !== "all") {
      list = list.filter((d) => d.screening?.decision === filters.decision);
    }
    if (filters.industry) {
      list = list.filter((d) => d.industry.toLowerCase().includes(filters.industry.toLowerCase()));
    }
    if (filters.state) {
      list = list.filter((d) => (d.state || d.location).includes(filters.state));
    }
    if (filters.re !== "all") {
      list = list.filter((d) => (filters.re === "yes" ? d.realEstateIncluded : d.realEstateIncluded === false));
    }
    if (filters.sf !== "all") {
      list = list.filter((d) => (filters.sf === "yes" ? d.sellerFinancing : d.sellerFinancing === false));
    }
    return list.sort((a, b) => (b.screening?.preNdaScore || 0) - (a.screening?.preNdaScore || 0));
  }, [deals, bestOnly, filters]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">Batch ranking</div>
          <h1 className="serif text-4xl">Which listings deserve an NDA?</h1>
        </div>
        <button className="btn btn-gold" onClick={() => setBestOnly((v) => !v)}>
          {bestOnly ? "Show all deals" : "Show me only the best deals"}
        </button>
      </div>

      <div className="card flex flex-wrap gap-3 rounded-2xl p-4 text-sm">
        <select
          className="rounded-lg border border-[var(--line)] bg-white px-2 py-1"
          value={filters.decision}
          onChange={(e) => setFilters({ ...filters, decision: e.target.value })}
        >
          <option value="all">All decisions</option>
          <option value="REQUEST_NDA">Request NDA</option>
          <option value="MAYBE">Maybe</option>
          <option value="PASS">Pass</option>
        </select>
        <input
          placeholder="Industry"
          className="rounded-lg border border-[var(--line)] px-2 py-1"
          value={filters.industry}
          onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
        />
        <input
          placeholder="State"
          className="w-24 rounded-lg border border-[var(--line)] px-2 py-1"
          value={filters.state}
          onChange={(e) => setFilters({ ...filters, state: e.target.value })}
        />
        <select
          className="rounded-lg border border-[var(--line)] bg-white px-2 py-1"
          value={filters.re}
          onChange={(e) => setFilters({ ...filters, re: e.target.value })}
        >
          <option value="all">Real estate: any</option>
          <option value="yes">Real estate included</option>
          <option value="no">No real estate</option>
        </select>
        <select
          className="rounded-lg border border-[var(--line)] bg-white px-2 py-1"
          value={filters.sf}
          onChange={(e) => setFilters({ ...filters, sf: e.target.value })}
        >
          <option value="all">Seller note: any</option>
          <option value="yes">Seller financing</option>
          <option value="no">No seller financing</option>
        </select>
      </div>

      <div className="card overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              {["Rank", "Company", "Industry", "Ask", "Revenue", "SDE/EBITDA", "Multiple", "Industry quality", "Growth", "Assets", "Owner 1A", "Pre-NDA 1B", "Decision"].map(
                (h) => (
                  <th key={h} className="px-3 py-3 font-medium">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {ranked.map((d, i) => {
              const earn = d.sde || d.ebitda;
              const m = multiple(d.askingPrice, earn);
              return (
                <tr key={d.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-3">{i + 1}</td>
                  <td className="px-3 py-3">
                    <Link className="font-semibold underline-offset-2 hover:underline" href={`/deals/${d.id}`}>
                      {d.name}
                    </Link>
                    <div className="text-xs text-[var(--muted)]">{d.location}</div>
                  </td>
                  <td className="px-3 py-3">{d.industry}</td>
                  <td className="px-3 py-3">{money(d.askingPrice)}</td>
                  <td className="px-3 py-3">{money(d.revenue)}</td>
                  <td className="px-3 py-3">{money(earn)}</td>
                  <td className="px-3 py-3">{m ? `${m.toFixed(1)}x` : "—"}</td>
                  <td className="px-3 py-3">{d.screening?.industryQuality ?? "—"}</td>
                  <td className="px-3 py-3">{d.screening?.growthScore ?? "—"}</td>
                  <td className="px-3 py-3">{d.screening?.assetsScore ?? "—"}</td>
                  <td className="px-3 py-3 font-semibold">
                    {d.ownerQuestions?.score ?? "—"}
                  </td>
                  <td className="px-3 py-3 font-semibold">{d.screening?.preNdaScore ?? "—"}</td>
                  <td className="px-3 py-3 text-xs">{d.screening?.decision?.replace("_", " ") || "Pending"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
