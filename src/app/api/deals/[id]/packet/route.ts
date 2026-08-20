import { NextResponse } from "next/server";
import { updateStore } from "@/lib/store";
import { analyzePacket, applyPacketAssignments } from "@/lib/packet";
import { id } from "@/lib/format";
import type { DocumentRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await ctx.params;
  const form = await req.formData();
  const files = form.getAll("files");
  const deal = await updateStore((store) => {
    const d = store.deals.find((x) => x.id === dealId);
    if (!d) return null;
    const texts: string[] = [];
    for (const f of files) {
      if (!(f instanceof File)) continue;
      const doc: DocumentRecord = {
        id: id("doc"),
        dealId,
        name: f.name,
        category: guessCategory(f.name),
        stage: 2,
        uploadedAt: new Date().toISOString(),
        size: f.size,
      };
      d.documents.push(doc);
    }
    // text field optional
    const pasted = String(form.get("text") || "");
    if (pasted) texts.push(pasted);
    const existing = d.documents.map((x) => x.textExcerpt).filter(Boolean).join("\n");
    d.packet = analyzePacket(d, `${pasted}\n${existing}`);
    applyPacketAssignments(d);
    d.status = "packet_review";
    d.updatedAt = new Date().toISOString();
    return d;
  });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deal });
}

function guessCategory(name: string): DocumentRecord["category"] {
  const n = name.toLowerCase();
  if (n.includes("cim") || n.includes("om") || n.includes("memo")) return "cim";
  if (n.includes("p&l") || n.includes("pnl") || n.includes("balance")) return "financials";
  if (n.includes("tax")) return "tax";
  if (n.includes("equip") || n.includes("ffe")) return "equipment";
  if (n.includes("customer")) return "customers";
  if (n.includes("real") || n.includes("lease")) return "real_estate";
  if (n.includes("legal") || n.includes("env")) return "legal";
  return "other";
}
