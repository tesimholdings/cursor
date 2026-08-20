import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type { Deal, Stage1Screening } from "./types";

const Enrichment = z.object({
  plainEnglishWhatTheyDo: z.string(),
  industryNeeded: z.string(),
  decisionWhy: z.string(),
});

export function hasAiKey() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY);
}

export async function enrichScreening(deal: Deal, base: Stage1Screening): Promise<Stage1Screening> {
  if (!hasAiKey()) return base;
  try {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY,
      baseURL: process.env.OPENAI_API_KEY
        ? undefined
        : "https://ai-gateway.vercel.sh/v1",
    });
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: Enrichment,
      prompt: `You are an acquisition partner for a non-expert buyer of $5–10M businesses.
Never fabricate company-specific facts. If unknown, say NOT PROVIDED.
Company: ${deal.name}
Industry: ${deal.industry}
Location: ${deal.location}
Ask: ${deal.askingPrice}
Revenue: ${deal.revenue}
SDE: ${deal.sde}
Notes: ${deal.notes || "none"}
Write:
1) high-school-level what they do
2) is the industry needed for 10+ years
3) a few sentences on whether to request NDA, maybe, or pass
Do not invent capacity, customers, or financials.`,
    });
    const q1 = base.questions.find((q) => q.id === 1);
    const q2 = base.questions.find((q) => q.id === 2);
    if (q1) {
      q1.answer = object.plainEnglishWhatTheyDo;
      q1.kind = "EXTERNAL_RESEARCH";
    }
    if (q2) q2.answer = object.industryNeeded;
    base.decisionWhy = object.decisionWhy;
    base.researchMode = "ai_enriched";
    return base;
  } catch {
    return base;
  }
}
