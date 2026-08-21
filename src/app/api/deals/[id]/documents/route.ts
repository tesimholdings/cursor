import { NextResponse } from "next/server";
import { extractDocument } from "@/lib/document-extraction";
import { id } from "@/lib/format";
import { analyzePacket, applyPacketAssignments } from "@/lib/packet";
import { researchDeal } from "@/lib/research";
import { readStore, updateStore } from "@/lib/store";
import { storeFailureResponse } from "@/lib/store-response";
import type { DocumentRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORY_CONFIG = {
  cim: { documentCategory: "cim", stage: 2 },
  teaser: { documentCategory: "listing", stage: 1 },
  financials: { documentCategory: "financials", stage: 3 },
} as const satisfies Record<
  string,
  {
    documentCategory: DocumentRecord["category"];
    stage: DocumentRecord["stage"];
  }
>;

const PRESERVE_ADVANCED_STATUS = new Set([
  "diligence",
  "loi",
  "financing",
  "closing",
  "acquired",
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await context.params;
  const existing = (await readStore()).deals.find((deal) => deal.id === dealId);
  if (!existing) {
    return NextResponse.json(
      { error: `No existing deal matches id ${dealId}.` },
      { status: 404 }
    );
  }

  const form = await request.formData();
  const category = String(form.get("category") || "").toLowerCase();
  if (!(category in CATEGORY_CONFIG)) {
    return NextResponse.json(
      { error: "category must be cim, teaser, or financials." },
      { status: 400 }
    );
  }
  const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
  const files = [
    ...form.getAll("file"),
    ...form.getAll("files"),
  ].filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length) {
    return NextResponse.json(
      { error: "Attach at least one PDF, XLSX, or XLSM file." },
      { status: 400 }
    );
  }

  const documents: DocumentRecord[] = [];
  for (const file of files) {
    if (!/\.(pdf|xlsx|xlsm)$/i.test(file.name)) {
      return NextResponse.json(
        { error: `${file.name} is not a supported PDF, XLSX, or XLSM file.` },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractDocument(file.name, buffer, file.type);
    const textExcerpt =
      extraction.status === "complete"
        ? extraction.chunks
            .map((chunk) => chunk.text)
            .join("\n")
            .slice(0, 20_000)
        : undefined;
    documents.push({
      id: id("doc"),
      dealId,
      name: file.name,
      category: config.documentCategory,
      stage: config.stage,
      uploadedAt: new Date().toISOString(),
      size: file.size,
      textExcerpt,
      extraction,
    });
  }

  try {
    const attached = await updateStore((store) => {
      const deal = store.deals.find((candidate) => candidate.id === dealId);
      if (!deal) return null;
      for (const document of documents) {
        const replaceIndex = deal.documents.findIndex(
          (existingDocument) =>
            existingDocument.name === document.name &&
            existingDocument.size === document.size &&
            existingDocument.category === document.category
        );
        if (replaceIndex >= 0) {
          deal.documents[replaceIndex] = document;
        } else {
          deal.documents.push(document);
        }
      }
      if (category === "cim") {
        deal.packet = analyzePacket(deal, "", deal.documents);
        applyPacketAssignments(deal);
        if (!PRESERVE_ADVANCED_STATUS.has(deal.status)) {
          deal.status = "packet_review";
        }
      } else if (category === "financials") {
        // New financial evidence invalidates any prior IC/model output. It
        // unlocks Step 3 but never runs Full IC automatically.
        deal.diligence = undefined;
        deal.financing = undefined;
        deal.tax = undefined;
        deal.downside = undefined;
        if (!PRESERVE_ADVANCED_STATUS.has(deal.status)) {
          deal.status = "packet_review";
        }
      }
      deal.updatedAt = new Date().toISOString();
      return deal;
    });
    if (!attached) {
      return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    }

    try {
      const refreshed = await researchDeal(dealId, { force: true });
      return NextResponse.json(
        {
          deal: refreshed,
          documents,
          matchedDeal: { id: refreshed.id, name: refreshed.name },
        },
        { status: 201 }
      );
    } catch (error) {
      // The attachment is already durable. Report a refresh failure without
      // pretending the document was lost or creating another deal.
      const current = (await readStore()).deals.find(
        (deal) => deal.id === dealId
      );
      return NextResponse.json(
        {
          deal: current,
          documents,
          matchedDeal: { id: attached.id, name: attached.name },
          screenRefreshError:
            error instanceof Error ? error.message : "Screen refresh failed.",
        },
        { status: 201 }
      );
    }
  } catch (error) {
    return storeFailureResponse(error);
  }
}
