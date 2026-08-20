import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type {
  Deal,
  OwnerQuestionReport,
  PublicResearch,
} from "./types";
import { validatedResearchSources } from "./public-research";

const OwnerResearchEnrichment = z.object({
  updates: z
    .array(
      z.object({
        id: z.number().int().min(1).max(40),
        answer: z.string(),
        result: z.string().optional(),
        known: z.array(z.string()).max(8),
        unknown: z.array(z.string()).max(8),
        sourceIds: z.array(z.string()).min(1).max(8),
      })
    )
    .max(40),
  prospects: z
    .array(
      z.object({
        company: z.string(),
        industry: z.string(),
        revenue: z.string(),
        location: z.string(),
        whyFit: z.string(),
        potentialOffering: z.string(),
        fit: z.enum(["High", "Medium", "Low"]),
        barrier: z.string(),
        sourceIds: z.array(z.string()).min(1).max(4),
      })
    )
    .max(30),
});

export function hasAiKey() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY);
}

export async function enrichOwnerQuestions(
  deal: Deal,
  base: OwnerQuestionReport,
  research: PublicResearch
): Promise<OwnerQuestionReport> {
  if (research.status !== "complete" || !research.sources.length) return base;

  // Even without a synthesis model, expose the fetched evidence rather than
  // pretending that research did not happen.
  base.companyBrief = research.sources
    .slice(0, 5)
    .map(
      (source) =>
        `${source.title}: ${
          source.excerpt?.slice(0, 280) || "Source found; no search excerpt."
        }`
    )
    .join("\n");
  base.researchStatus = "complete";

  if (!hasAiKey()) return base;
  try {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY,
      baseURL: process.env.OPENAI_API_KEY
        ? undefined
        : "https://ai-gateway.vercel.sh/v1",
    });
    const sourcePacket = research.sources
      .map(
        (source) =>
          `[${source.id}] ${source.title}\nURL: ${source.url}\nEXCERPT: ${
            source.excerpt || "No excerpt"
          }`
      )
      .join("\n\n");
    const questionPacket = base.questions
      .map(
        (question) =>
          `${question.id}. ${question.title}\nCURRENT: ${question.answer}`
      )
      .join("\n\n");
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: OwnerResearchEnrichment,
      prompt: `You are the evidence analyst for TESIM's Acquisition Command Center.
Use ONLY the supplied source excerpts. Never rely on memory and never invent a
URL, source ID, number, customer, competitor, utilization, margin, or capacity.
Seller/listing statements remain seller claims. If sources do not answer a
question, omit that question from updates; the app will preserve UNANSWERED.
Every update MUST cite one or more exact source IDs that directly support it.
Prospects may be returned only when the company name appears in a cited source
excerpt. They are prospects, never confirmed customers. Do not fill to 30 by
guessing; return fewer or none when sources do not support names.
Keep answers in plain English and explicitly distinguish sourced fact from
inference. Do not turn estimates into verified facts.

COMPANY
${deal.name} | ${deal.industry} | ${deal.location}

SOURCES
${sourcePacket}

OWNER QUESTIONS
${questionPacket}`,
    });

    const validIds = new Set(research.sources.map((source) => source.id));
    for (const update of object.updates) {
      if (
        !update.sourceIds.length ||
        update.sourceIds.some((sourceId) => !validIds.has(sourceId))
      ) {
        continue;
      }
      const question = base.questions.find((item) => item.id === update.id);
      if (!question) continue;
      const citedSources = validatedResearchSources(
        update.sourceIds,
        research
      );
      if (!citedSources.length) continue;
      question.answer = update.answer;
      question.result = update.result || question.result;
      question.known = update.known;
      question.unknown = update.unknown;
      question.sources = citedSources;
      question.kind = "EXTERNAL_RESEARCH";
    }
    base.prospects = object.prospects
      .filter((prospect) => {
        if (
          prospect.sourceIds.some((sourceId) => !validIds.has(sourceId))
        ) {
          return false;
        }
        const cited = research.sources.filter((source) =>
          prospect.sourceIds.includes(source.id)
        );
        const haystack = cited
          .map((source) => `${source.title} ${source.excerpt || ""}`)
          .join(" ")
          .toLowerCase();
        return haystack.includes(prospect.company.toLowerCase());
      })
      .map((prospect) => ({
        company: prospect.company,
        industry: prospect.industry,
        revenue: prospect.revenue,
        location: prospect.location,
        whyFit: prospect.whyFit,
        potentialOffering: prospect.potentialOffering,
        fit: prospect.fit,
        barrier: prospect.barrier,
      }));
    const prospectQuestion = base.questions.find((question) => question.id === 8);
    if (prospectQuestion && base.prospects.length) {
      prospectQuestion.answer = `${base.prospects.length} potential companies were identified in fetched public sources. They are prospects only, not confirmed customers or confirmed fits. Fewer than 30 means the evidence did not support more names.`;
      prospectQuestion.result = `${base.prospects.length} CITED PROSPECT(S) — FIT UNVERIFIED`;
      prospectQuestion.kind = "EXTERNAL_RESEARCH";
      prospectQuestion.sources = research.sources.filter((source) =>
        object.prospects.some(
          (prospect) =>
            prospect.company ===
              base.prospects.find((item) => item.company === prospect.company)
                ?.company && prospect.sourceIds.includes(source.id)
        )
      );
      prospectQuestion.details = base.prospects
        .map(
          (prospect, index) =>
            `${index + 1}. ${prospect.company} | ${prospect.industry} | ${
              prospect.revenue
            } | ${prospect.location} | ${prospect.fit} | Could buy: ${
              prospect.potentialOffering
            } | Fit: ${prospect.whyFit} | Barrier: ${prospect.barrier}`
        )
        .join("\n");
    }
    return base;
  } catch (error) {
    base.companyBrief += `\n\nAI synthesis unavailable: ${
      error instanceof Error ? error.message : "unknown error"
    }. Fetched sources remain available; no unsupported claims were added.`;
    return base;
  }
}
