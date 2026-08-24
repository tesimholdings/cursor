"use client";

import { useEffect, useState } from "react";
import type { Deal, FinancingInputs, Team } from "@/lib/types";
import { money, pct } from "@/lib/format";
import {
  canRunFullIc,
  dealFunnelStep,
  stageCopy,
} from "@/lib/pipeline";
import { TrafficDot } from "@/components/EvidenceBadge";
import { resolveAssigneeName } from "@/lib/assign";
import { OwnerQuestionsPanel } from "@/components/OwnerQuestionsPanel";
import { BoardScorePanel } from "@/components/BoardScores";
import { DealPicturePanel } from "@/components/DealPicture";
import { AskAboutDeal } from "@/components/AskAboutDeal";
import { DealHeader } from "@/components/DealHeader";
import { DealDocuments } from "@/components/DealDocuments";
import { DealScanFunnel } from "@/components/DealScanFunnel";
import { companyScan, hasRealOwnerQa } from "@/lib/company-scan";
import {
  icHeadlineScore,
  icPillarContribution,
  IC_PURCHASE_VALUE_PILLARS,
} from "@/lib/board-scoring";

export function DealClient({ id }: { id: string }) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [fullQs, setFullQs] = useState(false);
  const [openQ, setOpenQ] = useState<number | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/deals/${id}`, { cache: "no-store" });
    const json = await res.json();
    setDeal(json.deal);
    setTeams(json.teams || []);
  }

  useEffect(() => {
    // Load the selected deal from the persisted server store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function action(name: string, extra?: object) {
    setOperationError(null);
    const res = await fetch(`/api/deals/${id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: name, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) {
      setOperationError(json.error || "Action failed.");
      return;
    }
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
    setOperationError(null);
    const res = await fetch(url, { method: "POST", body: new FormData(form) });
    const json = await res.json();
    if (!res.ok) {
      setOperationError(json.error || "Upload failed.");
      return;
    }
    if (json.screenRefreshError) {
      setOperationError(
        `Document attached, but the company screen could not refresh: ${json.screenRefreshError}`
      );
    }
    setDeal(json.deal);
  }

  if (!deal) return <p className="text-[var(--muted)]">Opening the deal file…</p>;

  const guide = stageCopy(deal);
  const d = deal.diligence;
  const p = deal.packet;
  const s = deal.screening;
  const o = deal.ownerQuestions;
  const fullIcReady = canRunFullIc(deal);
  const funnelStep = dealFunnelStep(deal);
  const scan = companyScan(deal);
  const showOwnerQa = hasRealOwnerQa(deal);

  return (
    <div className="space-y-5">
      {d?.fatalRisks?.length ? (
        <div className="rounded-2xl bg-black px-5 py-4 text-white">
          <div className="text-xs tracking-[0.2em]">FATAL RISK</div>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {d.fatalRisks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {operationError && (
        <div className="rounded-xl bg-red-100 p-4 text-sm text-red-900">
          {operationError}
        </div>
      )}

      <DealHeader deal={deal} />
      <DealPicturePanel deal={deal} />
      <DealDocuments deal={deal} onUpload={upload} />
      <DealScanFunnel deal={deal} />

      <div className="flex flex-wrap gap-2">
        {deal.researchStatus !== "complete" && (
          <button className="btn btn-primary" onClick={research}>
            Screen this company
          </button>
        )}
        {funnelStep === 1 && deal.status !== "passed" && (
          <button className="btn btn-primary" onClick={() => action("nda")}>
            Inquire + NDA
          </button>
        )}
        {deal.status !== "passed" && deal.status !== "acquired" && (
          <button className="btn btn-danger" onClick={() => action("pass")}>
            Pass
          </button>
        )}
        {guide.nextButton && funnelStep > 1 && (
          <button className="btn btn-primary" onClick={() => action(guide.nextButton!.action)}>
            {guide.nextButton.label}
          </button>
        )}
      </div>

      {showOwnerQa && o && (
        <details className="card rounded-2xl p-5">
          <summary className="serif cursor-pointer text-2xl">Owner Q&amp;A</summary>
          <div className="mt-4">
            <OwnerQuestionsPanel
              deal={deal}
              report={o}
              research={deal.publicResearch}
            />
          </div>
        </details>
      )}

      <details className="card rounded-2xl p-5">
        <summary className="serif cursor-pointer text-2xl">Public research</summary>
        <div className="mt-3 text-sm">
          {deal.publicResearch?.status === "complete" &&
          deal.publicResearch.sources.length ? (
            <ol className="list-decimal space-y-1 pl-5">
              {deal.publicResearch.sources.map((source) => (
                <li key={source.id}>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer" className="underline">
                      {source.title}
                    </a>
                  ) : (
                    source.title
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[var(--muted)]">
              {deal.publicResearch?.reason || "No public sources on this card."}
            </p>
          )}
        </div>
      </details>

      <details className="card rounded-2xl p-5">
        <summary className="serif cursor-pointer text-2xl">Team assignment</summary>
        <label className="mt-3 block text-sm">
          Acquisition team
          <select
            className="mt-1 w-full max-w-sm rounded-lg border border-[var(--line)] bg-white p-2"
            value={deal.teamId || ""}
            onChange={(event) =>
              fetch(`/api/deals/${deal.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId: event.target.value }),
              }).then(load)
            }
          >
            <option value="">Unassigned</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        {deal.assignedQuestions.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm">
            {deal.assignedQuestions.map((question) => (
              <li
                key={question.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] py-2"
              >
                <span>{question.question}</span>
                <span className="text-[var(--muted)]">
                  {resolveAssigneeName(question.assigneeId, teams, deal.teamId)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="card rounded-2xl p-5">
        <summary className="serif cursor-pointer text-2xl">Ask about this deal</summary>
        <div className="mt-4">
          <AskAboutDeal key={deal.id} dealId={deal.id} dealName={deal.name} />
        </div>
      </details>

      <details className="card rounded-2xl p-5">
        <summary className="serif cursor-pointer text-2xl">Pipeline tools</summary>
        <div className="mt-5 space-y-6">
          <p className="text-sm text-[var(--muted)]">
            Step {scan.funnelStep} of 5 · {scan.nextAction}
          </p>
          <BoardScorePanel deal={deal} />

          {s && (
            <details className="rounded-xl border border-[var(--line)] p-4">
              <summary className="cursor-pointer font-semibold">
                Listing / public financial screen
              </summary>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Score {s.preNdaScore}/100 · {s.decision.replace(/_/g, " ")}
              </p>
              <ol className="mt-4 space-y-2">
                {s.questions
                  .filter((question) => !/^unanswered\b/i.test(question.answer))
                  .map((question) => (
                    <li key={question.id} className="border-b border-[var(--line)] pb-3">
                      <button
                        className="flex w-full items-start justify-between gap-3 text-left"
                        onClick={() => setOpenQ(openQ === question.id ? null : question.id)}
                      >
                        <span>
                          <span className="text-[var(--muted)]">{question.id}.</span>{" "}
                          {question.title}
                          <div className="mt-1 text-sm">
                            {question.answer.slice(0, openQ === question.id ? 4000 : 180)}
                            {openQ === question.id || question.answer.length < 180 ? "" : "…"}
                          </div>
                        </span>
                        <TrafficDot light={question.light} />
                      </button>
                    </li>
                  ))}
              </ol>
            </details>
          )}

          <section className="rounded-xl border border-[var(--line)] p-4">
            <h3 className="font-semibold">Paste a CIM excerpt</h3>
            <form
              className="mt-3 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                upload(`/api/deals/${deal.id}/packet`, event.currentTarget);
              }}
            >
              <textarea
                name="text"
                rows={3}
                required
                className="w-full rounded-lg border border-[var(--line)] p-2 text-sm"
                placeholder="Paste CIM excerpts…"
              />
              <button className="btn btn-ghost">Review pasted excerpt</button>
            </form>
            {p && (
              <div className="mt-4 space-y-3 text-sm">
                <p className="font-semibold">
                  Packet {p.score}/100 — {p.decision.replace(/_/g, " ")}
                </p>
                <p>{p.decisionWhy}</p>
                <ol className="list-decimal pl-5">
                  {(fullQs ? p.fullDiligenceQuestions : p.topQuestions).map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ol>
                <button className="text-sm underline" onClick={() => setFullQs(!fullQs)}>
                  {fullQs ? "Show short list" : "Show full due diligence list"}
                </button>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[var(--line)] p-4">
            <h3 className="font-semibold">Financials / QoE</h3>
            <form
              className="mt-3 flex flex-wrap items-center gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                upload(`/api/deals/${deal.id}/diligence`, event.currentTarget);
              }}
            >
              <input type="hidden" name="action" value="upload" />
              <input name="files" type="file" accept=".pdf,.xlsx,.csv,.txt" multiple />
              <button className="btn btn-ghost">Upload financials / QoE</button>
            </form>
          </section>

          <section className="rounded-xl border border-[var(--line)] p-4">
            <h3 className="font-semibold">Full IC</h3>
            {!fullIcReady ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                Locked until a readable financials / QoE file is attached.
              </p>
            ) : !d ? (
              <form
                className="mt-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  upload(`/api/deals/${deal.id}/diligence`, event.currentTarget);
                }}
              >
                <input type="hidden" name="action" value="run_ic" />
                <button className="btn btn-primary">Run Full IC</button>
              </form>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                <p className="serif text-xl">
                  {icHeadlineScore(d.scores)} / 100 — {d.finalDecision.replace(/_/g, " ")}
                </p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {IC_PURCHASE_VALUE_PILLARS.map((pillar) => (
                    <div key={pillar.key} className="rounded-xl bg-[var(--paper)] p-3">
                      <div className="text-xs text-[var(--muted)]">{pillar.label}</div>
                      <div className="font-semibold">
                        {icPillarContribution(
                          d.scores[pillar.key],
                          pillar.max,
                          pillar.weight
                        )}{" "}
                        / {pillar.weight}
                      </div>
                    </div>
                  ))}
                </div>
                <p>
                  <strong>Maximum price:</strong>{" "}
                  {d.maxPrice.value == null ? "—" : money(d.maxPrice.value)}
                  {" — "}
                  {d.maxPrice.basis}
                </p>
                <a className="btn btn-ghost" href={`/api/deals/${deal.id}/report`}>
                  Download IC report
                </a>
              </div>
            )}
          </section>

          {deal.financing && (
            <section className="rounded-xl border border-[var(--line)] p-4">
              <h3 className="font-semibold">Financing sketch</h3>
              <FinancingForm
                inputs={deal.financing.inputs}
                onSave={(inputs) => action("", { inputs })}
              />
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <Stat label="Annual debt service" value={money(deal.financing.result.annualDebtService)} />
                <Stat label="DSCR" value={deal.financing.result.dscr?.toFixed(2) ?? "—"} />
                <Stat label="Cash after debt" value={money(deal.financing.result.cashAfterDebt)} />
                <Stat
                  label="Cash-on-cash"
                  value={
                    deal.financing.result.cashOnCash != null
                      ? pct(deal.financing.result.cashOnCash)
                      : "—"
                  }
                />
              </dl>
            </section>
          )}

          {deal.tax && (
            <section className="rounded-xl border border-[var(--line)] p-4 text-sm">
              <h3 className="font-semibold">Tax sketch (CPA must verify)</h3>
              <p className="mt-2">{deal.tax.disclaimer}</p>
            </section>
          )}

          {funnelStep >= 4 && d && (
            <section className="rounded-xl border border-[var(--line)] p-4 text-sm">
              <h3 className="font-semibold">LOI / price / structure</h3>
              {funnelStep === 4 && (
                <button className="btn btn-primary mt-3" onClick={() => action("loi")}>
                  Move to LOI / price / structure
                </button>
              )}
              {funnelStep === 5 && <p className="mt-2 font-semibold">{guide.stageLabel}</p>}
            </section>
          )}
        </div>
      </details>
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
      onSubmit={(event) => {
        event.preventDefault();
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
            onChange={(event) => setV({ ...v, [k]: Number(event.target.value) })}
          />
        </label>
      ))}
      <button className="btn btn-ghost col-span-2">Recalculate</button>
    </form>
  );
}
