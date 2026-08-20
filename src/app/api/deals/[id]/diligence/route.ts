import { NextResponse } from "next/server";
import { updateStore } from "@/lib/store";
import { attachModels, runDiligence } from "@/lib/diligence";
import { id } from "@/lib/format";
import {
  extractDocument,
  guessDocumentCategory,
} from "@/lib/document-extraction";
import type { DocumentRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const uploadedDocuments: DocumentRecord[] = [];
  if (form) {
    for (const file of form.getAll("files")) {
      if (!(file instanceof File)) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      uploadedDocuments.push({
        id: id("doc"),
        dealId,
        name: file.name,
        category: guessDocumentCategory(file.name),
        stage: 3,
        uploadedAt: new Date().toISOString(),
        size: file.size,
        extraction: await extractDocument(file.name, buffer, file.type),
      });
    }
  }
  const deal = await updateStore((store) => {
    const d = store.deals.find((x) => x.id === dealId);
    if (!d) return null;
    d.documents.push(...uploadedDocuments);
    d.diligence = runDiligence(d);
    attachModels(d);
    d.status = "diligence";
    d.updatedAt = new Date().toISOString();
    return d;
  });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deal });
}
