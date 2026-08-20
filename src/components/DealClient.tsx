"use client";

import { useEffect, useState } from "react";
import type { Deal, FinancingInputs, Team } from "@/lib/types";
import { money, pct } from "@/lib/format";
import { stageCopy } from "@/lib/pipeline";
import { EvidenceBadge, TrafficDot } from "@/components/EvidenceBadge";
import { ScoreRing } from "@/components/ScoreRing";
import { resolveAssigneeName } from "@/lib/assign";

export function DealClient({ id }: { id: string }) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [fullQs, setFullQs] = useState(false);
  const [openQ, setOpenQ] = useState<number | null>(null);

  async function load() {
    const res = await fetch(`/api/deals/${id}`, { cache: "no-store" });
    const json = await res.json();
    setDeal(json.deal);
    setTeams(json.teams || []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function action(name: string, extra?: object) {
    const res = await fetch(`/api/deals/${id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: name, ...extra }),
    });
    const json = await res.json();
    setDeal(json.deal);
  }

  async function research() {
    const res = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId: id }),
    });
    const json = await res.json();
    setDeal(json.deal);
  }

  async function upload(url: string, form: HTMLFormElement) {
    const res = await fetch(url, { method: "POST", body: new FormData(form) });
    const json = await res.json();
    setDeal(json.deal);
  }

  if (!deal) return <p className="text-[var(--muted)]">Opening the deal file…</p>;

  const guide = stageCopy(deal);
  const s = deal.screening;
  const p = deal.packet;
  const d = deal.diligence;

  return (
    <div className="space-y-6">
      {d?.fatalRisks?.length ? (
        <div className="rounded-2xl bg-black px-5 py-4 text-white">
          <div className="text-xs tracking-[0.2em]">FATAL RISK</div>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {d.fatalRisks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-white/70">A high score can never hide a fatal risk.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="kicker">{guide.stageLabel}</div>
          <h1 className="serif text-4xl">{deal.name}</h1>
          <p className="mt-1 text-[var(--muted)]">
            {deal.industry} · {deal.location} · Ask {money(deal.askingPrice)} · Revenue {money(deal.revenue)} · SDE{" "}
            {money(deal.sde)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {s && <ScoreRing score={d?.scores.total || p?.score || s.preNdaScore} />}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="card rounded-2xl p-5 md:col-span-2">
          <div className="kicker">Where are we?</div>
          <h2 className="serif text-2xl">{guide.stageLabel}</h2>
          <div className="mt-4 kicker">What do I need to do?</div>
          <p className="mt-1 text-lg">{guide.needToDo}</p>
          <div className="mt-4 kicker">What did we find?</div>
          <p className="mt-1">{s?.whatWeKnow || "Not screened yet."}</p>
          <div className="mt-4 kicker">What should we do?</div>
          <p className="mt-1">{s?.whatNext || d?.whatNext || "Start screening."}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {deal.researchStatus !== "complete" && (
              <button className="btn btn-primary" onClick={research}>
                Screen this company
              </button>
            )}
            {s?.decision === "REQUEST_NDA" && deal.status === "screened" && (
              <button className="btn btn-primary" onClick={() => action("nda")}>
                Request NDA
              </button>
            )}
            {s?.decision === "MAYBE" && deal.status === "screened" && (
              <button className="btn btn-gold" onClick={() => action("nda")}>
                Request NDA anyway
              </button>
            )}
            {deal.status !== "passed" && deal.status !== "acquired" && (
              <button className="btn btn-danger" onClick={() => action("pass")}>
                Pass
              </button>
            )}
            {guide.nextButton && deal.status !== "screened" && (
              <button className="btn btn-primary" onClick={() => action(guide.nextButton!.action)}>
                {guide.nextButton.label}
              </button>
            )}
            <a className="btn btn-ghost" href={`/api/deals/${deal.id}/report`}>
              Download IC report
            </a>
          </div>
        </section>
        <section className="card rounded-2xl p-5 space-y-3">
          <div className="kicker">The answer</div>
          <p className="serif text-2xl">
            {(d?.finalDecision || p?.decision || s?.decision || "NOT SCREENED").toString().replace(/_/g, " ")}
          </p>
          <p className="text-sm">{p?.decisionWhy || s?.decisionWhy || d?.whatNext}</p>
          <div>
            <div className="kicker">Why</div>
            <p className="text-sm text-[var(--muted)]">{s?.whyItMatters}</p>
          </div>
          <label className="block text-sm">
            Acquisition team
            <select
              className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white p-2"
              value={deal.teamId || ""}
              onChange={(e) =>
                fetch(`/api/deals/${deal.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ teamId: e.target.value }),
                }).then(load)
              }
            >
              <option value="">Unassigned</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      </div>

      <FourBox
        know={d?.whatWeKnow || p?.whatWeKnow || s?.whatWeKnow || "Listing only."}
        dont={d?.whatWeDont || p?.whatWeDont || s?.whatWeDont || "Almost everything that matters for a close."}
        why={d?.whyItMatters || p?.whyItMatters || s?.whyItMatters || "We only need the next decision."}
        next={d?.whatNext || p?.whatNext || s?.whatNext || "Screen it."}
      />

      {s && (
        <details open className="card rounded-2xl p-5">
          <summary className="serif cursor-pointer text-2xl">Stage 1 — Pre-NDA questions</summary>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Score {s.preNdaScore}/100 · {s.researchMode === "ai_enriched" ? "AI-enriched" : "Listing + industry knowledge"} ·
            Valuation {s.valuationLabel} · Tax attractiveness {s.taxAttractiveness}
          </p>
          <ol className="mt-4 space-y-2">
            {s.questions.map((q) => (
              <li key={q.id} className="border-b border-[var(--line)] pb-3">
                <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpenQ(openQ === q.id ? null : q.id)}>
                  <span>
                    <span className="text-[var(--muted)]">{q.id}.</span> {q.title}
                    <div className="mt-1 text-sm">{q.answer.slice(0, openQ === q.id ? 4000 : 180)}{openQ === q.id || q.answer.length < 180 ? "" : "…"}</div>
                  </span>
                  <TrafficDot light={q.light} />
                </button>
                {openQ === q.id && (
                  <div className="mt-3 space-y-2 text-sm">
                    <EvidenceBadge kind={q.kind} />
                    <p><strong>Why it matters.</strong> {q.why}</p>
                    <p><strong>What we know.</strong> {q.known.join(" ") || "—"}</p>
                    <p><strong>What we don’t.</strong> {q.unknown.join(" ") || "—"}</p>
                    <p><strong>What to do next.</strong> {q.next}</p>
                    {q.details && <pre className="whitespace-pre-wrap rounded-lg bg-[var(--paper)] p-3 text-xs">{q.details}</pre>}
                  </div>
                )}
              </li>
            ))}
          </ol>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold">Prospect list (not confirmed customers)</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {s.prospects.map((pr, i) => (
                <li key={i}>
                  <strong>{pr.company}</strong> · {pr.fit} · {pr.location} — {pr.whyFit}
                </li>
              ))}
            </ul>
          </details>
        </details>
      )}

      <section className="card rounded-2xl p-5">
        <h2 className="serif text-2xl">Stage 2 — Information packet</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Upload the CIM, P&Ls, equipment list, or paste key pages. We compare listing vs packet and never silently pick a number.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            upload(`/api/deals/${deal.id}/packet`, e.currentTarget);
          }}
        >
          <input name="files" type="file" multiple />
          <textarea
            name="text"
            rows={4}
            className="w-full rounded-lg border border-[var(--line)] p-2 text-sm"
            placeholder="Paste CIM excerpts, revenue, SDE, add-backs, customer comments…"
          />
          <button className="btn btn-primary">Run second filter</button>
        </form>
        {p && (
          <div className="mt-6 space-y-4">
            <p className="serif text-xl">
              Information packet score {p.score}/100 — {p.decision.replace(/_/g, " ")}
            </p>
            <p>{p.decisionWhy}</p>
            {p.evidence.map((ev) => (
              <div key={ev.label} className="rounded-xl bg-[var(--paper)] p-3 text-sm">
                <div className="flex items-center justify-between">
                  <strong>{ev.label}</strong>
                  <EvidenceBadge kind={ev.kind} />
                </div>
                <div>Listing: {ev.listingValue}</div>
                <div>Packet: {ev.packetValue}</div>
                {ev.difference && <div className="font-semibold text-[var(--red)]">{ev.difference}</div>}
              </div>
            ))}
            {Object.entries(p.answers).map(([k, v]) => (
              <details key={k}>
                <summary className="cursor-pointer text-sm font-medium">
                  {k} <EvidenceBadge kind={v.kind} />
                </summary>
                <p className="mt-2 text-sm">{v.answer}</p>
              </details>
            ))}
            <div>
              <h3 className="font-semibold">Top questions we still need answered</h3>
              <ol className="mt-2 list-decimal pl-5 text-sm">
                {(fullQs ? p.fullDiligenceQuestions : p.topQuestions).map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
              <button className="mt-2 text-sm underline" onClick={() => setFullQs(!fullQs)}>
                {fullQs ? "Show short list" : "Show full due diligence list"}
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <h3 className="font-semibold">5 reasons to buy</h3>
                <ul className="list-disc pl-5">{p.reasonsToBuy.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
              <div>
                <h3 className="font-semibold">5 reasons to pass</h3>
                <ul className="list-disc pl-5">{p.reasonsToPass.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="card rounded-2xl p-5">
        <h2 className="serif text-2xl">Stage 3 — Full due diligence</h2>
        <form
          className="mt-3 flex flex-wrap items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            upload(`/api/deals/${deal.id}/diligence`, e.currentTarget);
          }}
        >
          <input name="files" type="file" multiple />
          <button className="btn btn-primary">Run diligence scoring</button>
        </form>
        {d && (
          <div className="mt-6 space-y-4">
            <p className="serif text-2xl">
              Final score {d.scores.total} / 100 — {d.finalDecision.replace(/_/g, " ")}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              {([
                ["Financial quality", d.scores.financial, 20],
                ["Customer quality", d.scores.customer, 15],
                ["Operations", d.scores.operations, 15],
                ["Growth", d.scores.growth, 15],
                ["Assets / downside", d.scores.assets, 10],
                ["Financing", d.scores.financing, 10],
                ["Tax efficiency", d.scores.tax, 10],
                ["Legal / environmental", d.scores.legal, 5],
              ] as const).map(([l, v, m]) => (
                <div key={l} className="rounded-xl bg-[var(--paper)] p-3">
                  <div className="text-xs text-[var(--muted)]">{l}</div>
                  <div className="font-semibold">
                    {v} / {m}
                  </div>
                </div>
              ))}
            </div>
            <details>
              <summary className="cursor-pointer font-semibold">Financial audit lines</summary>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {d.financials.map((f) => (
                    <tr key={f.name} className="border-b border-[var(--line)]">
                      <td className="py-1">{f.name}</td>
                      <td>{money(f.listing)}</td>
                      <td>
                        <EvidenceBadge kind={f.kind} /> {f.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-sm">
                Seller SDE {money(d.sellerSde)} vs buyer-adjusted SDE {money(d.buyerSde)} vs normalized EBITDA{" "}
                {money(d.normalizedEbitda)}
              </p>
            </details>
            <details>
              <summary className="cursor-pointer font-semibold">Customers</summary>
              <p className="text-sm">Concentration flag: {d.concentrationFlag.replace("_", " ")}</p>
              <ul className="text-sm">
                {d.customers.map((c) => (
                  <li key={c.name}>
                    {c.name}: {money(c.revenue)} ({pct(c.share)})
                  </li>
                ))}
              </ul>
            </details>
            <details>
              <summary className="cursor-pointer font-semibold">Growth plan</summary>
              {Object.entries(d.growthPlan).map(([k, items]) => (
                <div key={k} className="mt-2">
                  <div className="text-sm font-medium">{k}</div>
                  <ul className="list-disc pl-5 text-sm">
                    {(items as string[]).map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </details>
          </div>
        )}
      </section>

      {deal.financing && (
        <section className="card rounded-2xl p-5">
          <h2 className="serif text-2xl">Financing sketch</h2>
          <FinancingForm
            inputs={deal.financing.inputs}
            onSave={(inputs) => action("", { inputs })}
          />
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Stat label="Annual debt service" value={money(deal.financing.result.annualDebtService)} />
            <Stat label="DSCR" value={deal.financing.result.dscr?.toFixed(2) ?? "—"} />
            <Stat label="Cash after debt" value={money(deal.financing.result.cashAfterDebt)} />
            <Stat label="Cash-on-cash" value={deal.financing.result.cashOnCash != null ? pct(deal.financing.result.cashOnCash) : "—"} />
          </dl>
          <ul className="mt-2 list-disc pl-5 text-sm text-[var(--muted)]">
            {deal.financing.result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {deal.tax && (
        <section className="card rounded-2xl p-5">
          <h2 className="serif text-2xl">Tax sketch (CPA must verify)</h2>
          <p className="text-sm">
            Year 1 deductions {money(deal.tax.year1Deductions)} · 5-year {money(deal.tax.year5Deductions)} · 10-year{" "}
            {money(deal.tax.year10Deductions)}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">{deal.tax.disclaimer}</p>
        </section>
      )}

      {deal.downside && (
        <section className="card rounded-2xl p-5">
          <h2 className="serif text-2xl">Downside testing</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--muted)]">
                <th>Case</th>
                <th>EBITDA</th>
                <th>Cash flow</th>
                <th>DSCR</th>
                <th>Equity return</th>
              </tr>
            </thead>
            <tbody>
              {deal.downside.map((c) => (
                <tr key={c.name} className="border-t border-[var(--line)]">
                  <td className="py-1">
                    <TrafficDot light={c.light} /> {c.name}
                  </td>
                  <td>{money(c.ebitda)}</td>
                  <td>{money(c.cashFlow)}</td>
                  <td>{c.dscr?.toFixed(2) ?? "—"}</td>
                  <td>{c.equityReturn != null ? pct(c.equityReturn) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {deal.assignedQuestions.length > 0 && (
        <section className="card rounded-2xl p-5">
          <h2 className="serif text-2xl">Assigned to the team</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {deal.assignedQuestions.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] py-2">
                <span>{q.question}</span>
                <span className="text-[var(--muted)]">{resolveAssigneeName(q.assigneeId, teams, deal.teamId)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FourBox({ know, dont, why, next }: { know: string; dont: string; why: string; next: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {[
        ["What we know", know],
        ["What we don’t know", dont],
        ["Why it matters", why],
        ["What to do next", next],
      ].map(([h, b]) => (
        <div key={h} className="card rounded-2xl p-4">
          <div className="kicker">{h}</div>
          <p className="mt-2 text-sm">{b}</p>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function FinancingForm({
  inputs,
  onSave,
}: {
  inputs: FinancingInputs;
  onSave: (i: FinancingInputs) => void;
}) {
  const [v, setV] = useState(inputs);
  return (
    <form
      className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
    >
      {(
        [
          ["purchasePrice", "Purchase price"],
          ["buyerEquity", "Buyer equity"],
          ["bankDebt", "Bank debt"],
          ["sbaDebt", "SBA debt"],
          ["realEstateDebt", "Real estate debt"],
          ["sellerNote", "Seller note"],
          ["equipmentFinancing", "Equipment financing"],
          ["earnout", "Earnout"],
          ["holdback", "Holdback"],
        ] as const
      ).map(([k, lab]) => (
        <label key={k}>
          {lab}
          <input
            className="mt-1 w-full rounded border border-[var(--line)] p-1"
            type="number"
            value={v[k]}
            onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })}
          />
        </label>
      ))}
      <button className="btn btn-ghost col-span-2">Recalculate</button>
    </form>
  );
}
