import { NextResponse } from "next/server";
import { readStore, updateStore } from "@/lib/store";
import { computeFinancing } from "@/lib/finance";
import type { FinancingInputs, PipelineStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAP: Record<string, PipelineStatus> = {
  nda: "nda_requested",
  wait_packet: "waiting_packet",
  packet: "packet_review",
  loi: "loi",
  financing: "financing",
  closing: "closing",
  acquired: "acquired",
  pass: "passed",
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json();
  const result = await updateStore((store) => {
    const d = store.deals.find((x) => x.id === id);
    if (!d) return { error: "Not found", status: 404 } as const;
    if (
      ["loi", "financing", "closing", "acquired"].includes(body.action) &&
      !d.diligence
    ) {
      return {
        error: "Step 5 is locked until the Full IC is complete.",
        status: 409,
      } as const;
    }
    if (body.action && MAP[body.action]) {
      d.status = MAP[body.action];
    }
    if (body.inputs as FinancingInputs) {
      const cf = d.diligence?.normalizedEbitda ?? null;
      d.financing = {
        inputs: body.inputs,
        result: computeFinancing(body.inputs, cf),
      };
    }
    if (body.questionId && body.status) {
      const q = d.assignedQuestions.find((x) => x.id === body.questionId);
      if (q) q.status = body.status;
    }
    d.updatedAt = new Date().toISOString();
    return { deal: d } as const;
  });
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }
  return NextResponse.json({ deal: result.deal });
}

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const store = await readStore();
  const deal = store.deals.find((d) => d.id === id);
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deal });
}
