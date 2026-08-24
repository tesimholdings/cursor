import { NextResponse } from "next/server";
import { applyDealPatch } from "@/lib/deal-patch";
import { withClickableDocumentUrls } from "@/lib/documents";
import { readStore, updateStore } from "@/lib/store";
import { storeFailureResponse } from "@/lib/store-response";

export const dynamic = "force-dynamic";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const store = await readStore();
  const deal = store.deals.find((d) => d.id === id);
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const origin = new URL(_.url).origin;
  return NextResponse.json({
    deal: withClickableDocumentUrls(deal, origin),
    teams: store.teams,
  });
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
      applyDealPatch(d, body);
      return d;
    });
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const origin = new URL(req.url).origin;
    return NextResponse.json({ deal: withClickableDocumentUrls(deal, origin) });
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
