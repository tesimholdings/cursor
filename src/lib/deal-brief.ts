import { classifyDeal } from "./classification";
import { firstSentences, looksLikeOcrDump, stripLeadingName, unanswered } from "./copy";
import { cimProse, hasReadableCim } from "./deal-picture";
import { money } from "./format";
import type { Deal, EvidenceKind } from "./types";

export interface CompanyHighlights {
  good: string[];
  bad: string[];
  interesting: string[];
}

export interface ConciseQuestionAnswer {
  question: string;
  answer: string;
  kind: EvidenceKind;
  why?: string;
  unknown?: string;
  next?: string;
}

function cleanExcerpt(value: string | undefined, max = 180) {
  if (!value) return "";
  const clean = stripLeadingName(value.replace(/\s+/g, " ").trim());
  if (clean.length <= max) return clean;
  const shortened = clean.slice(0, max);
  const sentence = shortened.lastIndexOf(".");
  return `${shortened.slice(0, sentence > 60 ? sentence + 1 : max).trim()}…`;
}

function companyEvidence(deal: Deal) {
  const note = cleanExcerpt(deal.notes);
  const document = [...deal.documents]
    .filter(
      (item) =>
        item.textExcerpt ||
        item.extraction?.chunks.some((chunk) => Boolean(chunk.text.trim()))
    )
    .sort((a, b) => {
      const priority = { cim: 3, financials: 2, listing: 1 };
      const categoryDifference =
        (priority[b.category as keyof typeof priority] || 0) -
        (priority[a.category as keyof typeof priority] || 0);
      return (
        categoryDifference ||
        Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt)
      );
    })[0];
  const rawExcerpt =
    document?.textExcerpt || document?.extraction?.chunks[0]?.text;
  const documentExcerpt = looksLikeOcrDump(rawExcerpt)
    ? ""
    : cleanExcerpt(rawExcerpt);
  const publicSource =
    deal.publicResearch?.status === "complete"
      ? deal.publicResearch.sources.find(
          (source) =>
            source.kind !== "SELLER_MATERIAL" && (source.excerpt || source.title)
        )
      : undefined;
  return { note, document, documentExcerpt, publicSource };
}

function sellerClaims(deal: Deal) {
  return [
    deal.askingPrice != null ? `ask ${money(deal.askingPrice)}` : "",
    deal.revenue != null ? `revenue ${money(deal.revenue)}` : "",
    deal.sde != null ? `SDE ${money(deal.sde)}` : "",
    deal.ebitda != null ? `EBITDA ${money(deal.ebitda)}` : "",
  ].filter(Boolean);
}

function take(items: string[]) {
  return [...new Set(items.filter(Boolean))].slice(0, 6);
}

export function companyHighlights(deal: Deal): CompanyHighlights {
  const { businessCategory, operatingStyleTags } = classifyDeal(deal);
  const style = operatingStyleTags[0];
  const { note, document, documentExcerpt, publicSource } =
    companyEvidence(deal);
  const claims = sellerClaims(deal);
  const location = deal.location || "location unanswered";
  const picture = deal.dealPicture?.summary;
  const cim = hasReadableCim(deal);

  const label = deal.industry || businessCategory;
  const good = take([
    cim
      ? firstSentences(
          cimProse(deal, 1) || picture || `${label} CIM is on the card.`,
          1
        )
      : `${label} in ${location}${
          note ? `: ${note}` : " — identified well enough for a broker call."
        }`,
    claims.length
      ? `${label} listing economics: ${claims.join(", ")} — Seller Claim until a CIM/tax tie-out.`
      : unanswered(`${label} ask, revenue, and earnings for a first-pass screen`),
    note && !cim ? `Listing note: “${note}”` : "",
    publicSource
      ? `Public supplement: “${publicSource.title}” — not a substitute for the CIM.`
      : "",
    document && !cim
      ? `Seller file on card: “${document.name}.”`
      : cim
        ? `${label} packet is past teaser-only because a CIM is attached.`
        : "",
  ]).slice(0, 5);

  const bad = take([
    claims.length
      ? `${label} listed earnings are not tax-tied unless a tax/QoE file says so.`
      : unanswered(`${label} asking price, revenue, and seller earnings`),
    unanswered(`${label} customer % unless a CIM prints it`),
    unanswered(
      `${label} owner hours and whether the shop runs without the seller`
    ),
    unanswered(`${label} measured utilization and the bottleneck`),
    !cim ? `No CIM on card for ${label} — listing screen only.` : "",
  ]).slice(0, 5);

  const interesting = take([
    `${businessCategory} / ${style} in ${location} is a screening lens, not proof of hours.`,
    documentExcerpt
      ? `From the file: “${documentExcerpt}”`
      : note
        ? `Listing note only: “${note}”`
        : unanswered(
            `${label} company-specific excerpt beyond the listing row`
          ),
    publicSource?.excerpt
      ? `Public excerpt: “${cleanExcerpt(publicSource.excerpt)}”`
      : "",
    deal.realEstateIncluded === true
      ? `${label}: listing says real estate is included — allocation still unanswered.`
      : `${label}: owned real estate is not established as part of the ask.`,
  ]).slice(0, 5);

  return { good, bad, interesting };
}

export function conciseDealQuestions(deal: Deal): ConciseQuestionAnswer[] {
  const { businessCategory, operatingStyleTags } = classifyDeal(deal);
  const { note, document, documentExcerpt, publicSource } =
    companyEvidence(deal);
  const claims = sellerClaims(deal);
  const location = deal.location || "a location not supplied";
  const cim = hasReadableCim(deal);

  const questions: ConciseQuestionAnswer[] = [
    {
      question: "What is this company?",
      answer: firstSentences(
        cimProse(deal, 2) ||
          note ||
          `${deal.industry || businessCategory} in ${location}. ${unanswered("what they sell and how work flows")}`,
        2
      ),
      kind: cim || note ? "SELLER_PROVIDED" : "NOT_PROVIDED",
      unknown: unanswered("exact product mix"),
      next: "Ask the broker for a two-sentence description and revenue mix.",
    },
    {
      question: "What economics are actually stated?",
      answer: claims.length
        ? `${claims.join(", ")}. Seller Claim, not verified cash flow.`
        : unanswered("ask, revenue, SDE, or EBITDA"),
      kind: claims.length ? "SELLER_PROVIDED" : "NOT_PROVIDED",
      unknown: unanswered("normalized earnings, add-backs, WC, maintenance capex"),
      next: "Request the CIM and readable financials before relying on earnings.",
    },
    {
      question: "How operationally involved does this look?",
      answer: `Categorized ${businessCategory}, tagged ${operatingStyleTags[0]}. Category screen only — not seller hours.`,
      kind: "ASSUMPTION",
      unknown: unanswered("owner duties and weekly hours"),
      next: "Ask who opens, sells, schedules, hires, and handles exceptions.",
    },
  ];

  if (document) {
    questions.push({
      question: "What did the supplied material add?",
      answer: documentExcerpt
        ? `“${document.name}” says: “${documentExcerpt}”`
        : `“${document.name}” is attached without a short readable excerpt.`,
      kind: "SELLER_PROVIDED",
      unknown: unanswered("whether the file ties to source financials"),
      next: "Open the evidence trail and verify each material claim.",
    });
  }

  if (publicSource) {
    questions.push({
      question: "What did public research add?",
      answer: publicSource.excerpt
        ? `Public supplement “${publicSource.title}”: “${cleanExcerpt(publicSource.excerpt)}”`
        : `Public source “${publicSource.title}” has no usable excerpt.`,
      kind: "EXTERNAL_RESEARCH",
      unknown: unanswered("any claim not in the fetched excerpt"),
      next: "Use the cited source only.",
    });
  }

  questions.push({
    question: "What is the next evidence gap?",
    answer: cim
      ? unanswered("concentration %, owner hours, and tax-tied earnings if the CIM did not print them")
      : "No CIM on card. Next step is the book, not more teaser prose.",
    kind: "NOT_PROVIDED",
    why: "These facts change the broker call or expose a fatal risk.",
    next: "Ask for customer revenue, an owner-duty map, and measured capacity.",
  });

  return questions;
}
