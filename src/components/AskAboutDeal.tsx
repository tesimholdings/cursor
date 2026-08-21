"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type {
  AskEvidenceLabel,
  DealAskClaim,
  DealAskCitation,
  DealAskHit,
  DealAskResult,
} from "@/lib/deal-ask";

const SUGGESTIONS = [
  "Who owns the real estate?",
  "Is the SDE tax-tied?",
  "What does this company actually do?",
  "What is customer concentration?",
];

const LABEL_TONE: Record<AskEvidenceLabel, string> = {
  "Seller Claim": "bg-amber-100 text-amber-950",
  "Verified Fact": "bg-emerald-100 text-emerald-900",
  Inference: "bg-sky-100 text-sky-900",
  Unanswered: "bg-stone-100 text-stone-600 border border-dashed border-stone-300",
};

interface ThreadTurn {
  question: string;
  answer: string;
  claims: DealAskClaim[];
  citations: DealAskCitation[];
  hits: DealAskHit[];
  unreadDocuments: DealAskResult["unreadDocuments"];
  usedPublicResearch: boolean;
}

function storageKey(dealId: string) {
  return `acc-deal-ask:${dealId}`;
}

export function AskAboutDeal({
  dealId,
  dealName,
}: {
  dealId: string;
  dealName: string;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ThreadTurn[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(dealId));
      if (raw) {
        const parsed = JSON.parse(raw) as ThreadTurn[];
        setTurns(Array.isArray(parsed) ? parsed.slice(-12) : []);
      } else {
        setTurns([]);
      }
    } catch {
      setTurns([]);
    }
    setReady(true);
  }, [dealId]);

  useEffect(() => {
    if (!ready) return;
    try {
      if (turns.length) {
        localStorage.setItem(storageKey(dealId), JSON.stringify(turns.slice(-12)));
      } else {
        localStorage.removeItem(storageKey(dealId));
      }
    } catch {
      // Storage is optional; the live thread still works in this page.
    }
  }, [dealId, turns, ready]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns, busy]);

  async function ask(nextQuestion = question) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setQuestion("");
    try {
      const response = await fetch(`/api/deals/${dealId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history: turns.slice(-6).flatMap((turn) => [
            { role: "user", content: turn.question },
            { role: "assistant", content: turn.answer },
          ]),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Ask failed.");
        setQuestion(trimmed);
        return;
      }
      const result = json as DealAskResult;
      setTurns((current) => [
        ...current,
        {
          question: result.question,
          answer: result.answer,
          claims: result.claims || [],
          citations: result.citations || [],
          hits: result.hits || [],
          unreadDocuments: result.unreadDocuments || [],
          usedPublicResearch: Boolean(result.usedPublicResearch),
        },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ask failed.");
      setQuestion(trimmed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="kicker">Ask about this deal</div>
          <h2 className="serif text-2xl">Search / Q&amp;A for {dealName}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Answers stay on this company. If a fact is not in the packet, the
            reply is Unanswered — not a guess. This is not a sales pitch.
          </p>
        </div>
        {turns.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => setTurns([])}
          >
            Clear thread
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-1 text-xs font-semibold hover:border-[var(--navy)]"
            onClick={() => void ask(suggestion)}
            disabled={busy}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {turns.length > 0 && (
        <ol className="mt-5 space-y-4">
          {turns.map((turn, index) => (
            <li
              key={`${turn.question}-${index}`}
              className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4"
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                You asked
              </div>
              <p className="mt-1 font-semibold">{turn.question}</p>
              <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                From this packet
              </div>
              <p className="mt-1 text-sm leading-relaxed">{turn.answer}</p>
              {turn.claims.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {turn.claims.slice(0, 6).map((claim, claimIndex) => (
                    <AskLabel key={`${claim.label}-${claimIndex}`} label={claim.label} />
                  ))}
                </div>
              )}
              {turn.citations.length > 0 && (
                <p className="mt-3 text-xs text-[var(--muted)]">
                  Cited:{" "}
                  {turn.citations
                    .map((citation) =>
                      [citation.title, citation.locator].filter(Boolean).join(" · ")
                    )
                    .join(" · ")}
                </p>
              )}
              {turn.hits.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold">
                    Found in this packet ({turn.hits.length})
                  </summary>
                  <ul className="mt-2 space-y-2 text-xs">
                    {turn.hits.map((hit) => (
                      <li key={hit.id}>
                        <span className="font-semibold">{hit.title}</span>
                        {hit.locator ? ` · ${hit.locator}` : ""}
                        <div className="text-[var(--muted)]">“{hit.excerpt}”</div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {turn.unreadDocuments.length > 0 && (
                <p className="mt-2 text-xs text-[var(--red)]">
                  Could not read:{" "}
                  {turn.unreadDocuments
                    .map((document) => `${document.name} (${document.error})`)
                    .join(" · ")}
                </p>
              )}
              {turn.usedPublicResearch && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Public-research excerpts already on this card were available as
                  a labeled supplement. They are not a second company’s file.
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          void ask();
        }}
      >
        <label htmlFor={`deal-ask-${dealId}`} className="sr-only">
          Ask about this deal
        </label>
        <div className="flex flex-col gap-3 md:flex-row">
          <textarea
            id={`deal-ask-${dealId}`}
            rows={2}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask();
              }
            }}
            placeholder={`Search this packet or ask about ${dealName}…`}
            className="min-h-[52px] w-full flex-1 rounded-xl border border-[var(--line)] bg-white p-3 text-sm"
          />
          <button className="btn btn-primary self-end" disabled={busy || !question.trim()}>
            <Search size={14} />
            {busy ? "Reading this packet…" : "Ask"}
          </button>
        </div>
      </form>
      {error && (
        <p className="mt-3 text-sm text-[var(--red)]">{error}</p>
      )}
      <div ref={endRef} />
    </section>
  );
}

function AskLabel({ label }: { label: AskEvidenceLabel }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${LABEL_TONE[label]}`}
    >
      {label}
    </span>
  );
}
