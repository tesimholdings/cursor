import type { Deal, DocumentRecord } from "./types";

const GENERATED_PACKET =
  /^(tavily-|ais-tight-copy-|ais[_-]tight)/i;

const PRIMARY_CIM_NAME =
  /\b(cim|teaser|cbr|\bom\b|offering[\s._-]*memo(?:randum)?|confidential[\s._-]*information|exec(?:utive)?[\s._-]*summ)/i;

export function contentTypeForName(name: string) {
  const extension = name.toLowerCase().split(".").pop() || "";
  if (extension === "pdf") return "application/pdf";
  if (extension === "xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (extension === "xlsm") {
    return "application/vnd.ms-excel.sheet.macroEnabled.12";
  }
  if (extension === "csv") return "text/csv";
  if (extension === "txt" || extension === "md") return "text/plain";
  return "application/octet-stream";
}

export function isGeneratedPacketFile(document: Pick<DocumentRecord, "name">) {
  return GENERATED_PACKET.test(document.name.trim());
}

export function isPrimaryCimDocument(document: DocumentRecord) {
  if (isGeneratedPacketFile(document)) return false;
  if (!/\.pdf$/i.test(document.name)) return false;
  if (document.category === "cim") return true;
  return PRIMARY_CIM_NAME.test(document.name);
}

export function primaryCimDocument(deal: Deal) {
  const matches = deal.documents.filter(isPrimaryCimDocument);
  const pdf = matches.find((document) => /\.pdf$/i.test(document.name));
  return pdf || matches[0] || null;
}

export function secondaryDocuments(deal: Deal, primary?: DocumentRecord | null) {
  const primaryId = (primary || primaryCimDocument(deal))?.id;
  return deal.documents.filter((document) => document.id !== primaryId);
}

export function documentClickUrl(
  dealId: string,
  document: DocumentRecord,
  origin?: string
) {
  if (document.blobUrl) return document.blobUrl;
  if (document.url && /^(https?:)?\/\//i.test(document.url)) return document.url;
  const path = `/api/deals/${dealId}/documents/${document.id}`;
  if (origin) return `${origin.replace(/\/$/, "")}${path}`;
  return document.url || path;
}

export function withClickableDocumentUrls(deal: Deal, origin?: string): Deal {
  return {
    ...deal,
    documents: deal.documents.map((document) => ({
      ...document,
      url: documentClickUrl(deal.id, document, origin),
      contentType: document.contentType || contentTypeForName(document.name),
    })),
  };
}

export function documentMetadata(document: DocumentRecord) {
  return {
    id: document.id,
    dealId: document.dealId,
    name: document.name,
    category: document.category,
    stage: document.stage,
    uploadedAt: document.uploadedAt,
    size: document.size,
    url: document.url,
    blobPathname: document.blobPathname,
    blobUrl: document.blobUrl,
    contentType: document.contentType || contentTypeForName(document.name),
  };
}

export function mergeDocumentMetadata(
  existing: DocumentRecord[],
  incoming: Array<Partial<DocumentRecord> & { id?: string }>
): DocumentRecord[] {
  const next = [...existing];
  for (const patch of incoming) {
    if (!patch.id) continue;
    const index = next.findIndex((document) => document.id === patch.id);
    const metadataKeys = [
      "name",
      "category",
      "stage",
      "url",
      "blobPathname",
      "blobUrl",
      "contentType",
      "size",
      "uploadedAt",
    ] as const;
    if (index >= 0) {
      const current = { ...next[index] };
      for (const key of metadataKeys) {
        if (patch[key] !== undefined) {
          (current as Record<string, unknown>)[key] = patch[key];
        }
      }
      next[index] = current;
      continue;
    }
    next.push({
      id: patch.id,
      dealId: String(patch.dealId || ""),
      name: String(patch.name || "Untitled"),
      category: (patch.category as DocumentRecord["category"]) || "other",
      stage: patch.stage || 1,
      uploadedAt: patch.uploadedAt || new Date().toISOString(),
      size: typeof patch.size === "number" ? patch.size : 0,
      url: patch.url,
      blobPathname: patch.blobPathname,
      blobUrl: patch.blobUrl,
      contentType: patch.contentType,
    });
  }
  return next;
}

export function documentViewerHtml(document: DocumentRecord) {
  const chunks =
    document.extraction?.chunks?.filter((chunk) => chunk.text?.trim()) || [];
  const excerpt = document.textExcerpt?.trim();
  const pages = chunks.length
    ? chunks
    : excerpt
      ? [{ text: excerpt, page: 1 }]
      : [];
  const body = pages
    .map((chunk, index) => {
      const page = chunk.page ?? index + 1;
      const text = escapeHtml(chunk.text.replace(/\s+/g, " ").trim());
      return `<section><h2>Page ${page}</h2><p>${text}</p></section>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(document.name)}</title>
    <style>
      body { font-family: Georgia, serif; max-width: 42rem; margin: 2rem auto; color: #1c1915; line-height: 1.45; }
      h1 { font-size: 1.4rem; }
      h2 { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6258; }
      section { margin: 1.5rem 0; padding-top: 1rem; border-top: 1px solid #d9d0c0; }
      p { white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(document.name)}</h1>
    ${body || "<p>No extracted text is stored for this file.</p>"}
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
