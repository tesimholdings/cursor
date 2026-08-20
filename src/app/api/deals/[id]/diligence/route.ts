import { NextResponse } from "next/server";
import { updateStore } from "@/lib/store";
import { attachModels, runDiligence } from "@/lib/diligence";
import { id } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const deal = await updateStore((store) => {
    const d = store.deals.find((x) => x.id === dealId);
    if (!d) return null;
    if (form) {
      for (const f of form.getAll("files")) {
        if (!(f instanceof File)) continue;
        d.documents.push({
          id: id("doc"),
          dealId,
          name: f.name,
          category: "other",
          stage: 3,
          uploadedAt: new Date().toISOString(),
          size: f.size,
        });
      }
    }
    d.diligence = runDiligence(d);
    attachModels(d);
    d.status = "diligence";
    d.updatedAt = new Date().toISOString();
    return d;
  });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deal });
}
