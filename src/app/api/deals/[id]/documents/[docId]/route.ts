import { NextResponse } from "next/server";
import { readDocumentBytes } from "@/lib/document-files";
import { documentViewerHtml } from "@/lib/documents";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: dealId, docId } = await context.params;
  const store = await readStore();
  const deal = store.deals.find((candidate) => candidate.id === dealId);
  const document = deal?.documents.find((item) => item.id === docId);
  if (!deal || !document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stored = await readDocumentBytes({
    dealId,
    documentId: docId,
    blobPathname: document.blobPathname,
    blobUrl: document.blobUrl,
    fileName: document.name,
  });
  if (stored) {
    return new NextResponse(new Uint8Array(stored.bytes), {
      headers: {
        "Content-Type": stored.contentType,
        "Content-Disposition": `inline; filename="${document.name.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  if (
    document.textExcerpt?.trim() ||
    document.extraction?.chunks?.some((chunk) => chunk.text?.trim())
  ) {
    return new NextResponse(documentViewerHtml(document), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=30",
      },
    });
  }

  return NextResponse.json(
    { error: "No file bytes are stored for this document." },
    { status: 404 }
  );
}
