"use client";

import { useState } from "react";
import type { OwnerQuestionReport, PublicResearch } from "@/lib/types";
import { EvidenceBadge, TrafficDot } from "./EvidenceBadge";
import { ScoreRing } from "./ScoreRing";

export function OwnerQuestionsPanel({
  report,
  research,
}: {
  report: OwnerQuestionReport;
  research?: PublicResearch;
}) {
  const [openSection, setOpenSection] = useState<string | null>("business");
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);

  return (
    <section className="card rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="kicker">Mandatory first screen</div>
          <h2 className="serif text-2xl">Step 1A — Owner Questions</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
            What is this thing, who needs it, can it grow, what limits it, what
            assets do we own, and should we request the NDA? Step 1B only runs
            after all 40 questions are processed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ScoreRing score={report.score} />
          <div>
            <div className="kicker">Owner score</div>
            <div className="max-w-48 text-sm font-semibold">
              {report.decision.replace(/_/g, " ")}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-[var(--paper)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Public research brief</h3>
          <span className="text-xs text-[var(--muted)]">
            {research?.status === "complete"
              ? `${research.sources.length} fetched source(s)`
              : "Unanswered — research unavailable"}
          </span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm">
          {report.companyBrief ||
            research?.reason ||
            "NOT AVAILABLE — no public research result was persisted."}
        </p>
        {research?.sources.length ? (
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-[var(--muted)]">
            {research.sources.map((source) => (
              <li key={source.id}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {source.title}
                </a>
                {source.query ? ` — query: ${source.query}` : ""}
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {report.sections.map((section) => {
          const open = openSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              className={`rounded-xl border p-4 text-left ${
                open
                  ? "border-[var(--navy)] bg-[var(--paper)]"
                  : "border-[var(--line)] bg-white"
              }`}
              onClick={() => setOpenSection(open ? null : section.id)}
            >
              <TrafficDot light={section.light} />
              <div className="mt-2 font-semibold">{section.title}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {section.summary} · Questions{" "}
                {section.questionIds[0]}
                {section.questionIds.length > 1
                  ? `–${section.questionIds.at(-1)}`
                  : ""}
              </div>
            </button>
          );
        })}
      </div>

      {openSection && (
        <div className="mt-5 rounded-xl border border-[var(--line)] bg-white p-4">
          <ol className="space-y-3">
            {report.questions
              .filter((question) => question.section === openSection)
              .map((question) => {
                const open = openQuestion === question.id;
                return (
                  <li
                    key={question.id}
                    className="border-b border-[var(--line)] pb-3 last:border-0"
                  >
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-4 text-left"
                      onClick={() =>
                        setOpenQuestion(open ? null : question.id)
                      }
                    >
                      <span>
                        <span className="text-[var(--muted)]">
                          {question.id}.
                        </span>{" "}
                        <span className="font-semibold">{question.title}</span>
                        {question.result && (
                          <span className="mt-1 block text-sm font-semibold text-[var(--navy)]">
                            {question.result}
                          </span>
                        )}
                        <span className="mt-1 block text-sm">
                          {question.answer.slice(0, open ? 10_000 : 190)}
                          {!open && question.answer.length > 190 ? "…" : ""}
                        </span>
                      </span>
                      <TrafficDot light={question.light} />
                    </button>

                    {open && (
                      <div className="mt-4 space-y-3 pl-5 text-sm">
                        <EvidenceBadge kind={question.kind} />
                        <p>
                          <strong>What we know.</strong>{" "}
                          {question.known.join(" ") ||
                            "No additional verified facts."}
                        </p>
                        <p>
                          <strong>What we don’t know.</strong>{" "}
                          {question.unknown.join(" ") ||
                            "No additional gap recorded."}
                        </p>
                        <p>
                          <strong>Why it matters.</strong> {question.why}
                        </p>
                        <p>
                          <strong>What to do next.</strong> {question.next}
                        </p>
                        {question.details && (
                          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--paper)] p-3 text-xs">
                            {question.details}
                          </pre>
                        )}
                        <div>
                          <strong>Sources.</strong>
                          {question.sources.length ? (
                            <ul className="mt-1 list-disc pl-5 text-xs text-[var(--muted)]">
                              {question.sources.map((source, index) => (
                                <li key={`${source.id}-${index}`}>
                                  {source.url ? (
                                    <a
                                      href={source.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline"
                                    >
                                      {source.title}
                                    </a>
                                  ) : (
                                    source.title
                                  )}{" "}
                                  · {source.kind.replace(/_/g, " ")}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-[var(--muted)]">
                              No public citation supports this answer; it remains
                              an estimate or unanswered.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
          </ol>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <SummaryList title="What we like" items={report.whatWeLike} />
        <SummaryList title="What concerns us" items={report.concerns} />
        <SummaryList
          title="Most important unanswered questions"
          items={report.unanswered}
        />
      </div>
      <div className="mt-4 rounded-xl bg-[var(--navy)] p-4 text-[#f7f1e4]">
        <div className="kicker !text-[#c9bea8]">
          Should we request the NDA?
        </div>
        <div className="serif mt-1 text-2xl">
          {report.decision.replace(/_/g, " ")}
        </div>
        <p className="mt-1 text-sm text-[#ded4c2]">{report.decisionWhy}</p>
      </div>
    </section>
  );
}

function SummaryList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl bg-[var(--paper)] p-4">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {items.length ? (
          items.map((item) => <li key={item}>{item}</li>)
        ) : (
          <li>Nothing strong enough to list yet.</li>
        )}
      </ul>
    </div>
  );
}
