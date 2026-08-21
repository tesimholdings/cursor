import { NextResponse } from "next/server";
import { readStore, updateStore } from "@/lib/store";
import { storeFailureResponse } from "@/lib/store-response";
import type { PipelineStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const store = await readStore();
  const deal = store.deals.find((d) => d.id === id);
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deal, teams: store.teams });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json();
  try {
    const deal = await updateStore((store) => {
      const d = store.deals.find((x) => x.id === id);
      if (!d) return null;
      if (body.status) d.status = body.status as PipelineStatus;
      if (body.teamId) d.teamId = body.teamId;
      if (body.fatalRisks) d.fatalRisks = body.fatalRisks;
      if (body.financing) d.financing = body.financing;
      d.updatedAt = new Date().toISOString();
      return d;
    });
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ deal });
  } catch (error) {
    return storeFailureResponse(error);
  }
}

export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const removed = await updateStore((store) => {
      const index = store.deals.findIndex((deal) => deal.id === id);
      if (index === -1) return null;
      const [deal] = store.deals.splice(index, 1);
      store.batches = store.batches.filter((batch) =>
        store.deals.some((other) => other.batchId === batch.id)
      );
      return deal;
    });
    if (!removed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ removed: { id: removed.id, name: removed.name } });
  } catch (error) {
    return storeFailureResponse(error);
  }
}
