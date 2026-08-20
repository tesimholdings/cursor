import { NextResponse } from "next/server";
import { updateStore } from "@/lib/store";
import { analyzePacket, applyPacketAssignments } from "@/lib/packet";
import { id } from "@/lib/format";
import type { DocumentRecord } from "@/lib/types";
import {
  extractDocument,
  guessDocumentCategory,
} from "@/lib/document-extraction";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await ctx.params;
  const form = await req.formData();
  const files = form.getAll("files");
  const uploadedDocuments: DocumentRecord[] = [];
  for (const file of files) {
    if (!(file instanceof File)) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    uploadedDocuments.push({
      id: id("doc"),
      dealId,
      name: file.name,
      category: guessDocumentCategory(file.name),
      stage: 2,
      uploadedAt: new Date().toISOString(),
      size: file.size,
      extraction: await extractDocument(file.name, buffer, file.type),
    });
  }
  const pasted = String(form.get("text") || "").trim();
  if (pasted) {
    uploadedDocuments.push({
      id: id("doc"),
      dealId,
      name: "Pasted seller packet text",
      category: "other",
      stage: 2,
      uploadedAt: new Date().toISOString(),
      size: Buffer.byteLength(pasted),
      textExcerpt: pasted,
      extraction: {
        status: "complete",
        extractedAt: new Date().toISOString(),
        chunks: [{ text: pasted }],
      },
    });
  }
  const deal = await updateStore((store) => {
    const d = store.deals.find((x) => x.id === dealId);
    if (!d) return null;
    d.documents.push(...uploadedDocuments);
    d.packet = analyzePacket(d, "", d.documents);
    applyPacketAssignments(d);
    d.status = "packet_review";
    d.updatedAt = new Date().toISOString();
    return d;
  });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deal });
}
