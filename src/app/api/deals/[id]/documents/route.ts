import { NextResponse } from "next/server";
import { storedDocumentUrl } from "@/lib/cim-drive";
import { extractDocument } from "@/lib/document-extraction";
import { storeUploadedDocument } from "@/lib/document-files";
import {
  documentClickUrl,
  documentMetadata,
  withClickableDocumentUrls,
} from "@/lib/documents";
import { id } from "@/lib/format";
import { refreshDealFromDocuments } from "@/lib/refresh-deal";
import { researchDeal } from "@/lib/research";
import { readStore, updateStore } from "@/lib/store";
import { storeFailureResponse } from "@/lib/store-response";
import type { DocumentRecord } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await context.params;
  const store = await readStore();
  const deal = store.deals.find((candidate) => candidate.id === dealId);
  if (!deal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    documents: deal.documents.map((document) => {
      const url =
        storedDocumentUrl(document) ||
        documentClickUrl(deal.id, document, origin);
      return {
        ...documentMetadata(document),
        ...(url ? { url } : {}),
      };
    }),
  });
}

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
    documents.push(
      await storeUploadedDocument({
        id: id("doc"),
        dealId,
        name: file.name,
        category: config.documentCategory,
        stage: config.stage,
        uploadedAt: new Date().toISOString(),
        size: file.size,
        textExcerpt,
        extraction,
        buffer,
      })
    );
  }

  const origin = new URL(request.url).origin;
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
      refreshDealFromDocuments(deal);
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
          deal: withClickableDocumentUrls(refreshed, origin),
          documents: documents.map((document) => ({
            ...documentMetadata(document),
            url: documentClickUrl(dealId, document, origin),
          })),
          matchedDeal: { id: refreshed.id, name: refreshed.name },
        },
        { status: 201 }
      );
    } catch (error) {
      const current = (await readStore()).deals.find(
        (deal) => deal.id === dealId
      );
      return NextResponse.json(
        {
          deal: current
            ? withClickableDocumentUrls(current, origin)
            : current,
          documents: documents.map((document) => ({
            ...documentMetadata(document),
            url: documentClickUrl(dealId, document, origin),
          })),
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
