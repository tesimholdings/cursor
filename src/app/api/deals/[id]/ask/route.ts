import { NextResponse } from "next/server";
import { answerDealQuestion, type DealAskMessage } from "@/lib/deal-ask";
import { readStore } from "@/lib/store";
import { storeFailureResponse } from "@/lib/store-response";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  let body: { question?: unknown; history?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const question = String(body.question || "").trim();
  if (!question) {
    return NextResponse.json(
      { error: "Type a question or search about this deal." },
      { status: 400 }
    );
  }
  if (question.length > 500) {
    return NextResponse.json(
      { error: "Keep the question under 500 characters." },
      { status: 400 }
    );
  }

  try {
    const store = await readStore();
    const deal = store.deals.find((candidate) => candidate.id === id);
    if (!deal) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }

    const history = Array.isArray(body.history)
      ? body.history
          .filter(
            (item): item is DealAskMessage =>
              Boolean(item) &&
              typeof item === "object" &&
              (item.role === "user" || item.role === "assistant") &&
              typeof item.content === "string"
          )
          .slice(-6)
      : [];

    const result = await answerDealQuestion(deal, question, history);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }
    return storeFailureResponse(error);
  }
}
