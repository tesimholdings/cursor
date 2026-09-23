import { NextResponse } from "next/server";
import { updateStore } from "@/lib/store";
import { attachModels, runDiligence } from "@/lib/diligence";
import { id } from "@/lib/format";
import { storeUploadedDocument } from "@/lib/document-files";
import {
  classifyDocument,
  extractDocument,
} from "@/lib/document-extraction";
import type { DocumentRecord } from "@/lib/types";
import { canRunFullIc } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const action = String(form?.get("action") || "upload");
  const uploadedDocuments: DocumentRecord[] = [];
  if (form) {
    for (const file of form.getAll("files")) {
      if (!(file instanceof File)) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      const extraction = await extractDocument(file.name, buffer, file.type);
      uploadedDocuments.push(
        await storeUploadedDocument({
          id: id("doc"),
          dealId,
          name: file.name,
          category: classifyDocument(file.name, extraction),
          stage: 3,
          uploadedAt: new Date().toISOString(),
          size: file.size,
          extraction,
          buffer,
        })
      );
    }
  }
  const result = await updateStore((store) => {
    const d = store.deals.find((x) => x.id === dealId);
    if (!d) return { error: "Not found", status: 404 } as const;
    d.documents.push(...uploadedDocuments);
    if (action === "run_ic") {
      if (!canRunFullIc(d)) {
        return {
          error:
            "Full IC is locked until a readable financials / QoE document is uploaded.",
          status: 409,
        } as const;
      }
      d.diligence = runDiligence(d);
      attachModels(d);
      d.status = "diligence";
    } else {
      if (!uploadedDocuments.length) {
        return {
          error: "Choose financials or a QoE packet to upload.",
          status: 400,
        } as const;
      }
      // Financial document intake unlocks Step 3, not Step 4.
      d.diligence = undefined;
      d.financing = undefined;
      d.tax = undefined;
      d.downside = undefined;
      d.status = "packet_review";
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
