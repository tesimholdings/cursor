import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { hasAiKey, numericClaimsSupported } from "./ai";
import { classifyDeal } from "./classification";
import { money } from "./format";
import { companyHighlights } from "./deal-brief";
import { boardScoresFor, headlineScore } from "./board-scoring";
import type { Deal, DocumentRecord, PublicResearch } from "./types";

export type AskEvidenceLabel =
  | "Seller Claim"
  | "Verified Fact"
  | "Inference"
  | "Unanswered";

export interface DealAskHit {
  id: string;
  title: string;
  excerpt: string;
  locator?: string;
  field?: string;
}

export interface DealAskClaim {
  text: string;
  label: AskEvidenceLabel;
  source?: string;
}

export interface DealAskCitation {
  title: string;
  field?: string;
  locator?: string;
}

export interface DealAskMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DealAskResult {
  dealId: string;
  dealName: string;
  question: string;
  answer: string;
  claims: DealAskClaim[];
  citations: DealAskCitation[];
  hits: DealAskHit[];
  unreadDocuments: Array<{ name: string; error: string }>;
  usedPublicResearch: boolean;
  mode: "packet" | "ai";
}

interface PacketSnippet {
  id: string;
  title: string;
  text: string;
  locator?: string;
  field?: string;
  kind: "field" | "document" | "qa" | "research";
}

export interface DealAskPacket {
  dealId: string;
  dealName: string;
  snippets: PacketSnippet[];
  unreadDocuments: Array<{ name: string; error: string }>;
  printedConcentrationPercents: string[];
  text: string;
}

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "about",
  "actually",
  "all",
  "also",
  "any",
  "are",
  "ask",
  "been",
  "being",
  "can",
  "current",
  "did",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "into",
  "is",
  "it",
  "its",
  "just",
  "not",
  "of",
  "on",
  "or",
  "than",
  "that",
  "the",
  "them",
  "then",
  "there",
  "they",
  "this",
  "to",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

const AskObject = z.object({
  answer: z.string().max(1800),
  claims: z
    .array(
      z.object({
        text: z.string().max(400),
        label: z.enum([
          "Seller Claim",
          "Verified Fact",
          "Inference",
          "Unanswered",
        ]),
        sourceIds: z.array(z.string()).max(4),
      })
    )
    .max(8),
  citationIds: z.array(z.string()).max(8),
});

export function unreadDealDocuments(deal: Deal) {
  return deal.documents
    .filter(
      (document) =>
        document.extraction?.status === "failed" ||
        document.extraction?.status === "unsupported"
    )
    .map((document) => ({
      name: document.name,
      error:
        document.extraction?.error ||
        "This document could not be read. OCR is not configured for scanned PDFs.",
    }));
}

export function printedConcentrationPercents(text: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /(?:customer concentration|concentration|top customer|largest customer|customer share)[^.]{0,80}?(\d+(?:\.\d+)?\s*%)/gi,
    /(\d+(?:\.\d+)?\s*%)[^.]{0,80}?(?:customer concentration|top customer|largest customer|of (?:sales|revenue|customers))/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const token = (match[1] || "").replace(/\s+/g, "");
      if (token) found.add(token);
    }
  }
  return [...found];
}

export function buildDealAskPacket(deal: Deal): DealAskPacket {
  const snippets: PacketSnippet[] = [];
  const tags = classifyDeal(deal);
  const highlights = companyHighlights(deal);
  const board = boardScoresFor(deal);
  const headline = headlineScore(deal);

  push(
    snippets,
    "field:identity",
    "Deal record",
    [
      `Company: ${deal.name}`,
      `Industry: ${deal.industry || "Unanswered"}`,
      `Location: ${deal.location || "Unanswered"}`,
      deal.state ? `State: ${deal.state}` : "",
      deal.broker ? `Broker: ${deal.broker}` : "",
      deal.source ? `Source: ${deal.source}` : "",
      `Category: ${tags.businessCategory}`,
      `Operating style: ${tags.operatingStyleTags.join(", ")}`,
      `Risk: ${tags.riskSnapshot}`,
      `Assets: ${tags.assetProfile}`,
      `TESIM box: ${tags.boxFit}`,
      `Earnings quality tag: ${tags.earningsQuality}`,
      `Record tag: ${tags.recordTag}`,
    ]
      .filter(Boolean)
      .join("\n"),
    "field",
    "identity"
  );

  push(
    snippets,
    "field:economics",
    "Listing economics (seller claims)",
    [
      `Asking price: ${money(deal.askingPrice)} — Seller Claim`,
      `Revenue: ${money(deal.revenue)} — Seller Claim`,
      `SDE: ${money(deal.sde)} — Seller Claim. Seller-recast SDE is never a Verified Fact.`,
      `EBITDA: ${money(deal.ebitda)} — Seller Claim. Seller-recast EBITDA is never a Verified Fact.`,
      `Employees: ${deal.employees ?? "Unanswered"}`,
      `FF&E: ${money(deal.ffe)}`,
      `Seller financing: ${flag(deal.sellerFinancing)}`,
      `Typical TESIM check is $5–10M asking. Tax never saves a bad company.`,
    ].join("\n"),
    "field",
    "economics"
  );

  push(
    snippets,
    "field:real_estate",
    "Real estate field",
    `Listing real-estate-included flag: ${flag(deal.realEstateIncluded)}. This says whether the listing claims real estate is in the deal. It does not name the owner unless a document or note says so.`,
    "field",
    "realEstateIncluded"
  );

  if (deal.notes?.trim()) {
    push(snippets, "field:notes", "Deal notes", deal.notes.trim(), "field", "notes");
  }

  push(
    snippets,
    "field:scores",
    "Board / IC scores",
    [
      `Headline: ${headline.label} ${headline.score}`,
      `Board average: ${board.average}`,
      `Financials ${board.financials.score} — ${board.financials.why}`,
      `Owner ${board.owner.score} — ${board.owner.why}`,
      `Growth ${board.growth.score} — ${board.growth.why}`,
      `Hands-off ${board.handsOff.score} — ${board.handsOff.why}`,
      `Safety ${board.safety.score} — ${board.safety.why}`,
      `Assets ${board.assets.score} — ${board.assets.why}`,
      deal.diligence
        ? `Full IC ${deal.diligence.scores.total} — ${deal.diligence.finalDecision}`
        : "Full IC: not run",
      "Scores are screening lenses (Inference), not proof the company is a buy.",
    ].join("\n"),
    "field",
    "scores"
  );

  for (const [tone, items] of [
    ["Good", highlights.good],
    ["Bad", highlights.bad],
    ["Interesting", highlights.interesting],
  ] as const) {
    if (!items.length) continue;
    push(
      snippets,
      `highlight:${tone.toLowerCase()}`,
      `${tone} bullets`,
      items.join("\n"),
      "field",
      `highlight:${tone}`
    );
  }

  if (deal.ownerQuestions) {
    for (const question of deal.ownerQuestions.questions) {
      push(
        snippets,
        `qa:owner:${question.id}`,
        `Owner Q${question.id}: ${question.title}`,
        [
          question.answer,
          question.result ? `Result: ${question.result}` : "",
          question.known.length ? `Known: ${question.known.join(" ")}` : "",
          question.unknown.length
            ? `Unknown: ${question.unknown.join(" ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        "qa",
        `ownerQuestion:${question.id}`
      );
    }
  }

  if (deal.screening) {
    for (const question of deal.screening.questions) {
      push(
        snippets,
        `qa:screen:${question.id}`,
        `Screen Q${question.id}: ${question.title}`,
        question.answer,
        "qa",
        `screening:${question.id}`
      );
    }
  }

  if (deal.packet) {
    push(
      snippets,
      "packet:summary",
      "Packet review",
      [
        `Score ${deal.packet.score} — ${deal.packet.decision}`,
        deal.packet.decisionWhy,
        deal.packet.whatWeKnow,
        deal.packet.whatWeDont,
      ]
        .filter(Boolean)
        .join("\n"),
      "field",
      "packet"
    );
    for (const evidence of deal.packet.evidence) {
      push(
        snippets,
        `packet:evidence:${slug(evidence.label)}`,
        `Packet evidence: ${evidence.label}`,
        [
          `Listing: ${evidence.listingValue ?? "—"}`,
          `Packet: ${evidence.packetValue ?? "—"}`,
          evidence.difference || "",
          evidence.source || "",
        ]
          .filter(Boolean)
          .join("\n"),
        "field",
        evidence.label,
        locatorFrom(evidence.source, evidence.page, evidence.sheet, evidence.cell)
      );
    }
  }

  if (deal.diligence) {
    const findings = deal.diligence.findings;
    push(
      snippets,
      "diligence:findings",
      "IC findings",
      [
        `Seller claims: ${findings.sellerClaims.join(" ") || "none"}`,
        `Verified facts: ${findings.verifiedFacts.join(" ") || "none"}`,
        `Inferences: ${findings.inferences.join(" ") || "none"}`,
        `Unanswered: ${findings.unanswered.join(" ") || "none"}`,
        `Concentration flag: ${deal.diligence.concentrationFlag} — ${deal.diligence.concentrationNote}`,
        deal.diligence.realEstateNotes
          ? `Real estate notes: ${deal.diligence.realEstateNotes}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      "field",
      "diligence"
    );
    for (const customer of deal.diligence.customers) {
      const percentPrinted =
        customer.source &&
        typeof customer.share === "number" &&
        Number.isFinite(customer.share);
      push(
        snippets,
        `diligence:customer:${slug(customer.name)}`,
        `Customer row: ${customer.name}`,
        percentPrinted
          ? `${customer.name} revenue ${money(customer.revenue)}; listed share ${(customer.share * 100).toFixed(1)}% from ${customer.source?.sheet || "customer file"}.`
          : `${customer.name} appears in a customer file. Share percent is Unanswered unless that file prints a percent.`,
        "document",
        "customers",
        customer.source
          ? [customer.source.sheet, customer.source.cell].filter(Boolean).join(" · ")
          : undefined
      );
    }
  }

  for (const document of deal.documents) {
    addDocumentSnippets(snippets, document);
  }

  if (deal.publicResearch?.status === "complete") {
    addResearchSnippets(snippets, deal.publicResearch);
  }

  const text = snippets.map((snippet) => snippet.text).join("\n");
  return {
    dealId: deal.id,
    dealName: deal.name,
    snippets,
    unreadDocuments: unreadDealDocuments(deal),
    printedConcentrationPercents: printedConcentrationPercents(text),
    text,
  };
}

export function searchDealPacket(
  deal: Deal,
  query: string,
  limit = 8
): DealAskHit[] {
  const packet = buildDealAskPacket(deal);
  return searchPacket(packet, query, limit);
}

export async function answerDealQuestion(
  deal: Deal,
  question: string,
  history: DealAskMessage[] = []
): Promise<DealAskResult> {
  const packet = buildDealAskPacket(deal);
  const hits = searchPacket(packet, question, 8).filter((hit) =>
    hitContainsQuery(hit, question)
  );
  const unreadDocuments = packet.unreadDocuments;
  const usedPublicResearch = packet.snippets.some((snippet) =>
    snippet.id.startsWith("research:")
  );

  const grounded = answerFromPacket(deal, packet, question, hits);
  let result: DealAskResult = {
    dealId: deal.id,
    dealName: deal.name,
    question: question.trim(),
    ...grounded,
    hits,
    unreadDocuments,
    usedPublicResearch,
    mode: "packet",
  };

  if (hasAiKey()) {
    try {
      const synthesized = await synthesizeAskAnswer(
        deal,
        packet,
        question,
        hits,
        history,
        unreadDocuments
      );
      result = {
        ...result,
        ...sanitizeAskResult(synthesized, packet, hits),
        hits,
        unreadDocuments,
        usedPublicResearch,
        mode: "ai",
      };
    } catch {
      // Keep the packet-grounded answer. The feature still works without synthesis.
    }
  }

  return result;
}

function searchPacket(
  packet: DealAskPacket,
  query: string,
  limit: number
): DealAskHit[] {
  const phrase = normalizeSearch(query);
  if (!phrase) return [];
  const tokens = tokensOf(phrase);
  const scored = packet.snippets
    .map((snippet) => {
      const hay = normalizeSearch(snippet.text);
      if (!hay) return null;
      let score = 0;
      const phraseAt = hay.indexOf(phrase);
      if (phraseAt >= 0) score += 12;
      const matched = tokens.filter((token) => hay.includes(token));
      if (tokens.length && matched.length === tokens.length) score += 6;
      score += matched.length;
      if (snippet.kind === "document") score += 3;
      if (snippet.id === "field:notes") score += 2;
      if (!score) return null;
      const excerpt =
        phraseAt >= 0
          ? excerptAround(snippet.text, locateRaw(snippet.text, phrase), phrase.length)
          : excerptAround(
              snippet.text,
              locateRaw(snippet.text, matched[0] || phrase),
              (matched[0] || phrase).length
            );
      return {
        score,
        hit: {
          id: snippet.id,
          title: snippet.title,
          excerpt,
          locator: snippet.locator,
          field: snippet.field,
        } satisfies DealAskHit,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return snippetRank(b.hit.id) - snippetRank(a.hit.id);
    });

  const seen = new Set<string>();
  const hits: DealAskHit[] = [];
  for (const row of scored) {
    if (seen.has(row.hit.id)) continue;
    seen.add(row.hit.id);
    hits.push(row.hit);
    if (hits.length >= limit) break;
  }
  return hits;
}

function answerFromPacket(
  deal: Deal,
  packet: DealAskPacket,
  question: string,
  hits: DealAskHit[]
): Pick<DealAskResult, "answer" | "claims" | "citations"> {
  const tags = classifyDeal(deal);
  const q = question.toLowerCase();
  const citations = citationsFrom(packet, hits);

  if (isRealEstateQuestion(q)) {
    return realEstateAnswer(deal, hits, citations);
  }
  if (isSdeQualityQuestion(q)) {
    return sdeQualityAnswer(deal, tags.earningsQuality, citations);
  }
  if (isWhatTheyDoQuestion(q)) {
    return whatTheyDoAnswer(deal, packet, hits, citations);
  }
  if (isConcentrationQuestion(q)) {
    return concentrationAnswer(deal, packet, hits, citations);
  }
  if (isOwnershipQuestion(q)) {
    return ownershipAnswer(deal, hits, citations);
  }

  const relevant = hits.filter((hit) => hitContainsQuery(hit, question));
  if (relevant.length) {
    const first = relevant[0];
    return {
      answer: `Found in this deal’s packet (${first.title}${
        first.locator ? `, ${first.locator}` : ""
      }): “${first.excerpt}”`,
      claims: [
        {
          text: first.excerpt,
          label: labelForSnippetKind(first.id),
          source: first.title,
        },
      ],
      citations: citationsFrom(packet, relevant),
    };
  }

  return unanswered(
    `Unanswered. Nothing in ${deal.name}’s deal record, Q&A, notes, or readable documents answers “${question.trim()}”.`,
    citations
  );
}

function realEstateAnswer(
  deal: Deal,
  hits: DealAskHit[],
  citations: DealAskCitation[]
): Pick<DealAskResult, "answer" | "claims" | "citations"> {
  const ownerHit =
    hits.find((hit) => isOwnershipLanguage(hit.excerpt)) ||
    (deal.notes && isOwnershipLanguage(deal.notes)
      ? {
          id: "field:notes",
          title: "Deal notes",
          excerpt: clip(deal.notes, 280),
          field: "notes",
        }
      : undefined);
  const claims: DealAskClaim[] = [
    {
      text: `Listing real-estate-included flag is ${flag(deal.realEstateIncluded)}.`,
      label: deal.realEstateIncluded == null ? "Unanswered" : "Seller Claim",
      source: "Real estate field",
    },
  ];

  if (ownerHit) {
    claims.push({
      text: ownerHit.excerpt,
      label: "Seller Claim",
      source: ownerHit.title,
    });
    return {
      answer: [
        `Seller Claim — ${ownerHit.title}${
          ownerHit.locator ? ` (${ownerHit.locator})` : ""
        }: “${ownerHit.excerpt}”`,
        deal.realEstateIncluded == null
          ? "Unanswered — the listing flag does not say whether real estate is in the deal."
          : `Seller Claim — listing flag: real estate ${
              deal.realEstateIncluded ? "is included" : "is not included"
            }.`,
        "Unanswered — a named deed holder / landlord is not verified.",
      ].join(" "),
      claims,
      citations,
    };
  }

  if (deal.realEstateIncluded === true) {
    return {
      answer:
        "Seller Claim — the listing flag says real estate is included in the deal. Unanswered — who holds title, the property address, and value/condition are not named in this packet.",
      claims: [
        ...claims,
        {
          text: "Who owns the real estate is not named in this packet.",
          label: "Unanswered",
        },
      ],
      citations,
    };
  }
  if (deal.realEstateIncluded === false) {
    return {
      answer:
        "Seller Claim — the listing flag says real estate is not included. Unanswered — whether the company leases, who the landlord is, and lease terms.",
      claims: [
        ...claims,
        {
          text: "Landlord / lease terms are not in this packet.",
          label: "Unanswered",
        },
      ],
      citations,
    };
  }
  if (hits.length) {
    return {
      answer: `Seller Claim — related packet text (${hits[0].title}): “${hits[0].excerpt}” Unanswered — a clear owner of the real estate is not stated.`,
      claims,
      citations,
    };
  }
  return unanswered(
    `Unanswered. ${deal.name}’s packet does not say who owns the real estate.`,
    citations
  );
}

function sdeQualityAnswer(
  deal: Deal,
  earningsQuality: string,
  citations: DealAskCitation[]
): Pick<DealAskResult, "answer" | "claims" | "citations"> {
  const sde = money(deal.sde);
  const ebitda = money(deal.ebitda);
  const claims: DealAskClaim[] = [
    {
      text: `Listed SDE ${sde} / EBITDA ${ebitda}.`,
      label: "Seller Claim",
      source: "Listing economics",
    },
    {
      text: `Earnings quality tag is ${earningsQuality}.`,
      label: "Inference",
      source: "Scan tag",
    },
  ];
  if (earningsQuality === "Tax-tied") {
    return {
      answer: `Inference — the card tags earnings quality as Tax-tied because this packet’s wording mentions a tax-return tie. Seller Claim — listed SDE ${sde} and EBITDA ${ebitda} stay seller numbers. They are not Verified Facts unless a tax return or QoE in this packet actually prints and ties the same figure.`,
      claims,
      citations,
    };
  }
  if (earningsQuality === "Recast") {
    return {
      answer: `Inference — the card tags earnings quality as Recast (add-backs / adjusted SDE or EBITDA language). Seller Claim — listed SDE ${sde} and EBITDA ${ebitda} are seller-recast figures and are never treated as Verified Facts. Unanswered — a tax-tied ordinary-business-income bridge is not in this packet.`,
      claims,
      citations,
    };
  }
  return {
    answer: `Unanswered — the card tags earnings quality as Unverified. Seller Claim — listed SDE ${sde} and EBITDA ${ebitda} are still seller numbers. Nothing in this packet proves a tax-return tie.`,
    claims: [
      ...claims,
      {
        text: "Tax-tied support is not in this packet.",
        label: "Unanswered",
      },
    ],
    citations,
  };
}

function whatTheyDoAnswer(
  deal: Deal,
  packet: DealAskPacket,
  hits: DealAskHit[],
  citations: DealAskCitation[]
): Pick<DealAskResult, "answer" | "claims" | "citations"> {
  const note = deal.notes?.replace(/\s+/g, " ").trim();
  const docHit =
    hits.find((hit) => hit.id.startsWith("doc:")) ||
    packet.snippets.find(
      (snippet) => snippet.kind === "document" && snippet.text.trim()
    );
  const parts = [
    `${deal.name} is listed as ${deal.industry || "an unspecified industry"} in ${
      deal.location || "an unspecified location"
    }.`,
  ];
  const claims: DealAskClaim[] = [
    {
      text: `${deal.industry || "Industry unanswered"} · ${deal.location || "Location unanswered"}`,
      label: deal.industry ? "Seller Claim" : "Unanswered",
      source: "Deal record",
    },
  ];
  if (note) {
    parts.push(`Seller Claim — deal notes: “${clip(note, 280)}”`);
    claims.push({ text: note, label: "Seller Claim", source: "Deal notes" });
  }
  if (docHit && "excerpt" in docHit) {
    parts.push(
      `Seller Claim — ${(docHit as DealAskHit).title}: “${(docHit as DealAskHit).excerpt}”`
    );
    claims.push({
      text: (docHit as DealAskHit).excerpt,
      label: "Seller Claim",
      source: (docHit as DealAskHit).title,
    });
  } else if (docHit && "text" in docHit) {
    const excerpt = clip(docHit.text, 280);
    parts.push(`Seller Claim — ${docHit.title}: “${excerpt}”`);
    claims.push({
      text: excerpt,
      label: "Seller Claim",
      source: docHit.title,
    });
  }
  if (!note && !docHit) {
    parts.push(
      "Unanswered — this packet does not include a plain-English description of products, services, or how work actually flows."
    );
    claims.push({
      text: "Day-to-day work and product mix are not described.",
      label: "Unanswered",
    });
  }
  return { answer: parts.join(" "), claims, citations };
}

function concentrationAnswer(
  deal: Deal,
  packet: DealAskPacket,
  hits: DealAskHit[],
  citations: DealAskCitation[]
): Pick<DealAskResult, "answer" | "claims" | "citations"> {
  const percents = packet.printedConcentrationPercents;
  if (percents.length) {
    const hit =
      hits.find((item) =>
        percents.some((percent) =>
          item.excerpt.replace(/\s+/g, "").includes(percent.replace(/\s+/g, ""))
        )
      ) || hits[0];
    return {
      answer: `Seller Claim — a source in this packet prints ${percents.join(
        ", "
      )}${hit ? ` (${hit.title}${hit.locator ? `, ${hit.locator}` : ""})` : ""}. That percent is not a Verified Fact unless the same file is a customer-revenue schedule we can read.`,
      claims: [
        {
          text: `Printed concentration language: ${percents.join(", ")}`,
          label: "Seller Claim",
          source: hit?.title,
        },
      ],
      citations,
    };
  }
  if (deal.diligence?.concentrationNote) {
    return {
      answer: `Unanswered — no source in this packet prints a customer-concentration percent. IC note: ${deal.diligence.concentrationNote}`,
      claims: [
        {
          text: "Customer concentration % is Unanswered.",
          label: "Unanswered",
        },
      ],
      citations,
    };
  }
  return unanswered(
    "Unanswered. Customer concentration % stays blank unless a document in this packet actually prints a percent.",
    citations
  );
}

function ownershipAnswer(
  deal: Deal,
  hits: DealAskHit[],
  citations: DealAskCitation[]
): Pick<DealAskResult, "answer" | "claims" | "citations"> {
  const ownerHit = hits.find((hit) =>
    /owner|founder|principal|seller is|owned by|president|ceo/i.test(hit.excerpt)
  );
  if (ownerHit) {
    return {
      answer: `Seller Claim — ${ownerHit.title}${
        ownerHit.locator ? ` (${ownerHit.locator})` : ""
      }: “${ownerHit.excerpt}” Unanswered — ownership percentage and entity title are not verified.`,
      claims: [
        {
          text: ownerHit.excerpt,
          label: "Seller Claim",
          source: ownerHit.title,
        },
      ],
      citations,
    };
  }
  return unanswered(
    `Unanswered. ${deal.name}’s packet does not name who owns the company.`,
    citations
  );
}

async function synthesizeAskAnswer(
  deal: Deal,
  packet: DealAskPacket,
  question: string,
  hits: DealAskHit[],
  history: DealAskMessage[],
  unreadDocuments: DealAskResult["unreadDocuments"]
) {
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY,
    baseURL: process.env.OPENAI_API_KEY
      ? undefined
      : "https://ai-gateway.vercel.sh/v1",
  });
  const historyText = history
    .slice(-6)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");
  const sourcePacket = compactPacket(packet, hits);
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: AskObject,
    prompt: `You are the deal-file analyst for TESIM's Acquisition Command Center.
Answer ONLY about this one company: ${deal.name} (id ${deal.id}).
Never use another company's numbers, names, percents, or addresses.
Never invent a number, name, percent, address, customer, or owner.
If the packet does not contain the fact, the answer must say Unanswered.
Default to the deal packet. Public-research snippets are a labeled supplement only.
Seller-recast SDE/EBITDA is always a Seller Claim.
Customer concentration % is Unanswered unless a packet source actually prints a percent.
Label every material number: Seller Claim, Verified Fact, Inference, or Unanswered.
Cite source IDs from the packet only. Keep the answer short.
TESIM: typical check is $5–10M. Tax never saves a bad company. Do not sell the deal.

UNREAD DOCUMENTS
${
  unreadDocuments.length
    ? unreadDocuments.map((doc) => `${doc.name}: ${doc.error}`).join("\n")
    : "None"
}

PRINTED CONCENTRATION PERCENTS IN THIS PACKET
${packet.printedConcentrationPercents.join(", ") || "none"}

PACKET
${sourcePacket}

PRIOR TURNS ON THIS DEAL
${historyText || "none"}

QUESTION
${question.trim()}`,
  });

  const byId = new Map(packet.snippets.map((snippet) => [snippet.id, snippet]));
  const claims = object.claims.flatMap((claim): DealAskClaim[] => {
    const sources = claim.sourceIds
      .map((sourceId) => byId.get(sourceId))
      .filter((snippet): snippet is PacketSnippet => Boolean(snippet));
    if (claim.sourceIds.length && !sources.length) return [];
    const citedText = sources.map((snippet) => snippet.text).join(" ");
    const unsupported =
      claim.label !== "Unanswered" &&
      !numericClaimsSupported(claim.text, citedText || packet.text);
    return [
      {
        text: claim.text,
        label: unsupported
          ? "Unanswered"
          : relabelEarnings(claim.text, claim.label),
        source: sources[0]?.title,
      },
    ];
  });

  const citations = object.citationIds
    .map((sourceId) => byId.get(sourceId))
    .filter((snippet): snippet is PacketSnippet => Boolean(snippet))
    .map((snippet) => ({
      title: snippet.title,
      field: snippet.field,
      locator: snippet.locator,
    }));

  return {
    answer: object.answer,
    claims,
    citations: citations.length ? citations : citationsFrom(packet, hits),
  };
}

function sanitizeAskResult(
  result: Pick<DealAskResult, "answer" | "claims" | "citations">,
  packet: DealAskPacket,
  hits: DealAskHit[]
): Pick<DealAskResult, "answer" | "claims" | "citations"> {
  let answer = result.answer.replace(/\s+/g, " ").trim();
  if (!answer) {
    return unanswered(
      `Unanswered. Nothing in ${packet.dealName}’s packet supports an answer.`,
      result.citations
    );
  }

  if (
    /\b(customer concentration|top customer|largest customer)\b/i.test(answer) &&
    !packet.printedConcentrationPercents.length
  ) {
    answer = stripPercents(answer);
    if (!/unanswered/i.test(answer)) {
      answer = `${answer} Unanswered — no source in this packet prints a concentration percent.`;
    }
  } else if (packet.printedConcentrationPercents.length) {
    const allowed = new Set(
      packet.printedConcentrationPercents.map((token) =>
        token.replace(/\s+/g, "").toLowerCase()
      )
    );
    const invented = [...answer.matchAll(/(\d+(?:\.\d+)?\s*%)/g)].some(
      (match) => !allowed.has(match[1].replace(/\s+/g, "").toLowerCase())
    );
    if (invented && /concentrat|top customer|largest customer/i.test(answer)) {
      answer = `${stripPercents(answer)} Unanswered — only printed percents from this packet may be used.`;
    }
  }

  if (!numericClaimsSupported(answer, packet.text) && /\$|\d/.test(answer)) {
    const hitText = hits.map((hit) => hit.excerpt).join(" ");
    if (!numericClaimsSupported(answer, `${packet.text}\n${hitText}`)) {
      return unanswered(
        `Unanswered. A generated answer used numbers that are not in ${packet.dealName}’s packet, so it was discarded.`,
        result.citations
      );
    }
  }

  if (!/\b(seller claim|verified fact|inference|unanswered)\b/i.test(answer)) {
    const labels = [...new Set(result.claims.map((claim) => claim.label))];
    if (labels.length) answer = `${labels.join(" / ")} — ${answer}`;
  }

  return {
    answer,
    claims: result.claims.map((claim) => ({
      ...claim,
      label: relabelEarnings(claim.text, claim.label),
    })),
    citations: result.citations,
  };
}

function compactPacket(packet: DealAskPacket, hits: DealAskHit[]) {
  const preferred = new Set([
    "field:identity",
    "field:economics",
    "field:real_estate",
    "field:notes",
    "field:scores",
    "packet:summary",
    "diligence:findings",
    ...hits.map((hit) => hit.id),
  ]);
  const chosen = packet.snippets.filter(
    (snippet) =>
      preferred.has(snippet.id) ||
      snippet.kind === "research" ||
      snippet.id.startsWith("highlight:")
  );
  const extras = packet.snippets
    .filter((snippet) => snippet.kind === "document" && !preferred.has(snippet.id))
    .slice(0, 12);
  return [...chosen, ...extras]
    .map(
      (snippet) =>
        `[${snippet.id}] ${snippet.title}${
          snippet.locator ? ` (${snippet.locator})` : ""
        }\n${clip(snippet.text, 900)}`
    )
    .join("\n\n")
    .slice(0, 24_000);
}

function addDocumentSnippets(
  snippets: PacketSnippet[],
  document: DocumentRecord
) {
  if (
    document.extraction?.status === "failed" ||
    document.extraction?.status === "unsupported"
  ) {
    return;
  }
  const chunks =
    document.extraction?.status === "complete"
      ? document.extraction.chunks
      : document.textExcerpt
        ? [{ text: document.textExcerpt }]
        : [];
  if (!chunks.length) return;
  chunks.slice(0, 400).forEach((chunk, index) => {
    if (!chunk.text?.trim()) return;
    const locator = locatorFrom(
      document.name,
      chunk.page,
      chunk.sheet,
      chunk.cell
    );
    push(
      snippets,
      `doc:${document.id}:${index}`,
      document.name,
      chunk.text,
      "document",
      document.category,
      locator
    );
  });
}

function addResearchSnippets(
  snippets: PacketSnippet[],
  research: PublicResearch
) {
  for (const source of research.sources.slice(0, 8)) {
    if (source.kind === "SELLER_MATERIAL") continue;
    const excerpt = source.excerpt?.trim();
    if (!excerpt) continue;
    push(
      snippets,
      `research:${source.id}`,
      `External research: ${source.title}`,
      excerpt,
      "research",
      "publicResearch",
      source.url
    );
  }
}

function citationsFrom(
  packet: DealAskPacket,
  hits: DealAskHit[]
): DealAskCitation[] {
  const fromHits = hits.slice(0, 4).map((hit) => ({
    title: hit.title,
    field: hit.field,
    locator: hit.locator,
  }));
  if (fromHits.length) return uniqueCitations(fromHits);
  const identity = packet.snippets.find((snippet) => snippet.id === "field:identity");
  return identity
    ? [{ title: identity.title, field: identity.field }]
    : [];
}

function uniqueCitations(items: DealAskCitation[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.title}|${item.locator || ""}|${item.field || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unanswered(
  answer: string,
  citations: DealAskCitation[]
): Pick<DealAskResult, "answer" | "claims" | "citations"> {
  return {
    answer,
    claims: [{ text: answer, label: "Unanswered" }],
    citations,
  };
}

function relabelEarnings(
  text: string,
  label: AskEvidenceLabel
): AskEvidenceLabel {
  if (/\b(sde|ebitda|seller-?recast|adjusted (?:sde|ebitda))\b/i.test(text)) {
    return "Seller Claim";
  }
  return label;
}

function labelForSnippetKind(id: string): AskEvidenceLabel {
  if (id.startsWith("research:")) return "Inference";
  if (id.startsWith("field:scores") || id.startsWith("highlight:"))
    return "Inference";
  if (id.startsWith("field:economics") || id.startsWith("doc:"))
    return "Seller Claim";
  return "Seller Claim";
}

function isRealEstateQuestion(q: string) {
  return /real estate|building|owned separately|who owns.{0,20}(property|building|real estate|plant|shop)|lease|landlord/.test(
    q
  );
}

function isSdeQualityQuestion(q: string) {
  return /tax[-\s]?tied|recast|add-?backs?|sde|ebitda|earnings quality/.test(q);
}

function isWhatTheyDoQuestion(q: string) {
  return /what does|what do they|what is this company|what (?:is|are) they|actually do|business do|company do/.test(
    q
  );
}

function isConcentrationQuestion(q: string) {
  return /concentrat|top customer|largest customer|customer mix|customer share/.test(
    q
  );
}

function isOwnershipQuestion(q: string) {
  return /who owns|owner name|who is the (owner|seller|founder)|ownership/.test(
    q
  ) && !isRealEstateQuestion(q);
}

function isOwnershipLanguage(text: string) {
  return /owned separately|owned by|seller owns|title (?:is )?held|landlord is|deed holder|lessor is|available for acquisition/.test(
    text
  );
}

function snippetRank(id: string) {
  if (id.startsWith("doc:")) return 3;
  if (id === "field:notes") return 2;
  if (id.startsWith("qa:")) return 1;
  return 0;
}

function hitContainsQuery(hit: DealAskHit, query: string) {
  const phrase = normalizeSearch(query);
  const tokens = tokensOf(phrase);
  const hay = normalizeSearch(`${hit.title} ${hit.excerpt}`);
  if (!hay) return false;
  if (phrase.length >= 4 && hay.includes(phrase)) return true;
  return tokens.some((token) => hay.includes(token));
}

function push(
  snippets: PacketSnippet[],
  id: string,
  title: string,
  text: string,
  kind: PacketSnippet["kind"],
  field?: string,
  locator?: string
) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;
  snippets.push({ id, title, text: clean, kind, field, locator });
}

function flag(value: boolean | null | undefined) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "Unanswered";
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function locatorFrom(
  _name?: string | null,
  page?: number | string | null,
  sheet?: string | null,
  cell?: string | null
) {
  return [
    page != null && page !== "" ? `page ${page}` : "",
    sheet ? `sheet ${sheet}` : "",
    cell ? `cell ${cell}` : "",
  ]
    .filter(Boolean)
    .join(" · ") || undefined;
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9%.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOf(phrase: string) {
  return phrase
    .split(" ")
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function locateRaw(text: string, needle: string) {
  const lower = text.toLowerCase();
  const direct = lower.indexOf(needle.toLowerCase());
  if (direct >= 0) return direct;
  const normalizedNeedle = normalizeSearch(needle);
  const words = text.split(/(\s+)/);
  let cursor = 0;
  let built = "";
  for (const part of words) {
    const next = built + normalizeSearch(part) + (/\s/.test(part) ? " " : "");
    if (normalizeSearch(next).includes(normalizedNeedle)) return cursor;
    built = next;
    cursor += part.length;
  }
  return 0;
}

function excerptAround(text: string, index: number, needleLength: number) {
  const radius = 160;
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + Math.max(needleLength, 8) + radius);
  const slice = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

function clip(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
}

function stripPercents(value: string) {
  return value.replace(/\d+(?:\.\d+)?\s*%/g, "Unanswered").replace(/\s+/g, " ").trim();
}
