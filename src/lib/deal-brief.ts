import { classifyDeal } from "./classification";
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

function cleanExcerpt(value: string | undefined, max = 220) {
  if (!value) return "";
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const shortened = clean.slice(0, max);
  const sentence = shortened.lastIndexOf(".");
  return `${shortened.slice(0, sentence > 80 ? sentence + 1 : max).trim()}…`;
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
  const documentExcerpt = cleanExcerpt(
    document?.textExcerpt || document?.extraction?.chunks[0]?.text
  );
  const publicSource =
    deal.publicResearch?.status === "complete"
      ? deal.publicResearch.sources.find(
          (source) => source.excerpt || source.title
        )
      : undefined;
  return { note, document, documentExcerpt, publicSource };
}

function sellerClaims(deal: Deal) {
  return [
    deal.askingPrice != null ? `asking price ${money(deal.askingPrice)}` : "",
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
  const location = deal.location || "location not provided";

  const good = take([
    `${deal.name} is identified as a ${deal.industry || "business type not provided"} opportunity in ${location}; that identity is sufficient for a targeted broker follow-up.`,
    claims.length
      ? `${deal.name}'s listing supplies ${claims.join(", ")} for first-pass screening; each remains a seller claim.`
      : `${deal.name}'s record avoids filling blank economics with estimates; the missing price and earnings fields remain visibly unanswered.`,
    note
      ? `${deal.name}'s listing includes a company-specific description: “${note}”`
      : `${deal.name}'s category is recorded as ${businessCategory}, but the listing has not supplied a narrative description yet.`,
    publicSource
      ? `Public research for ${deal.name} includes “${publicSource.title}”; any conclusions still have to stay within that source's excerpt.`
      : `${deal.name} has no completed public-source excerpt to lean on, so this screen stays confined to the supplied listing.`,
    document
      ? `${deal.name} has supplied material named “${document.name}” available for evidence review.`
      : `${deal.name} has a discrete deal record that preserves unanswered fields instead of manufacturing a complete story.`,
  ]).slice(0, 5);

  const bad = take([
    claims.length
      ? `${deal.name}'s listed economics have not been verified against readable financials or a QoE packet.`
      : `Not in the listing yet for ${deal.name}: asking price, revenue, and seller earnings sufficient for an economics screen.`,
    `Not in the listing yet for ${deal.name}: customer concentration, named customer evidence, and contract or retention support.`,
    `Not in the listing yet for ${deal.name}: the owner's weekly duties and evidence that the operation can run without the seller.`,
    `Not in the listing yet for ${deal.name}: measured utilization, operating bottlenecks, and maintenance or replacement needs.`,
    !document
      ? `${deal.name} has no readable CIM or financial/QoE document attached, so Full IC remains unavailable.`
      : "",
  ]).slice(0, 5);

  const interesting = take([
    `${deal.name} maps to ${businessCategory} and carries the ${style} operating-style tag under TESIM's category rule; that tag is a screening lens, not proof of actual owner hours.`,
    `${deal.name}'s ${location} location is known, while local competition and market quality remain unanswered.`,
    documentExcerpt
      ? `One supplied excerpt for ${deal.name} says: “${documentExcerpt}”`
      : `${deal.name} does not yet have a company document excerpt that adds detail beyond the listing record.`,
    publicSource?.excerpt
      ? `A fetched public excerpt for ${deal.name} says: “${cleanExcerpt(publicSource.excerpt)}”`
      : `${deal.name}'s public-research record does not yet provide a usable company-specific excerpt.`,
    deal.realEstateIncluded === true
      ? `${deal.name}'s listing says real estate is included; value, condition, and transaction allocation are still unanswered.`
      : `${deal.name}'s record does not establish that owned real estate is included in the transaction.`,
  ]).slice(0, 5);

  return { good, bad, interesting };
}

export function conciseDealQuestions(deal: Deal): ConciseQuestionAnswer[] {
  const { businessCategory, operatingStyleTags } = classifyDeal(deal);
  const { note, document, documentExcerpt, publicSource } =
    companyEvidence(deal);
  const claims = sellerClaims(deal);
  const location = deal.location || "a location not supplied";

  const questions: ConciseQuestionAnswer[] = [
    {
      question: "What is this company?",
      answer: documentExcerpt
        ? `${deal.name} is listed as ${deal.industry || businessCategory} in ${location}. Its supplied ${document?.category.toUpperCase()} says: “${documentExcerpt}”`
        : note
          ? `${deal.name} is listed as ${deal.industry || businessCategory} in ${location}. The listing says: “${note}”`
          : `${deal.name} is listed as ${deal.industry || businessCategory} in ${location}. Not in the listing yet: a plain-English description of what it sells and how work flows.`,
      kind: documentExcerpt || note ? "SELLER_PROVIDED" : "NOT_PROVIDED",
      unknown: "Exact product or service mix and day-to-day workflow.",
      next: "Ask the broker for a two-sentence business description and revenue mix.",
    },
    {
      question: "What economics are actually stated?",
      answer: claims.length
        ? `${deal.name}'s listing states ${claims.join(", ")}. These are seller claims, not verified earnings or cash flow.`
        : `Not in the listing yet for ${deal.name}: asking price, revenue, SDE, or EBITDA sufficient for first-pass economics.`,
      kind: claims.length ? "SELLER_PROVIDED" : "NOT_PROVIDED",
      unknown: "Normalized earnings, add-backs, working capital, and maintenance capex.",
      next: "Request the CIM and readable financials before relying on earnings.",
    },
    {
      question: "How operationally involved does this look?",
      answer: `${deal.name} is categorized as ${businessCategory} and tagged ${operatingStyleTags[0]} under TESIM's operating-style rule. This is a category-level screen, not evidence of the seller's actual hours or management depth.`,
      kind: "ASSUMPTION",
      unknown: "Owner duties, manager authority, and weekly owner hours.",
      next: "Ask who opens, closes, sells, schedules, hires, and handles exceptions.",
    },
  ];

  if (document) {
    questions.push({
      question: "What did the supplied material add?",
      answer: documentExcerpt
        ? `${deal.name} includes “${document.name}.” Its extracted text says: “${documentExcerpt}”`
        : `${deal.name} includes “${document.name},” but no short readable excerpt is available in this view.`,
      kind: "SELLER_PROVIDED",
      unknown: "Whether the supplied material reconciles to source financial records.",
      next: "Open the evidence trail and verify each material claim.",
    });
  }

  if (publicSource) {
    questions.push({
      question: "What did public research add?",
      answer: publicSource.excerpt
        ? `Research for ${deal.name} includes “${publicSource.title}.” The fetched excerpt says: “${cleanExcerpt(publicSource.excerpt)}”`
        : `Research for ${deal.name} includes the source “${publicSource.title},” but no excerpt supports a broader factual conclusion.`,
      kind: "EXTERNAL_RESEARCH",
      unknown: "Any claim not directly supported by the fetched source excerpt.",
      next: "Use the cited source only; do not infer customers, utilization, or financial performance.",
    });
  }

  questions.push({
    question: "What is the next evidence gap?",
    answer: `Not in the listing yet for ${deal.name}: customer concentration, owner dependence, and verified operating capacity. Those gaps stay unanswered rather than being filled with category boilerplate.`,
    kind: "NOT_PROVIDED",
    why: "These facts can change the broker call or expose a fatal risk.",
    next: "Ask for customer revenue, an owner-duty map, and measured capacity evidence.",
  });

  return questions;
}
