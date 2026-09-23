import {
  isDumpDocument,
  openCimUrl,
  persistableCimDriveUrl,
  storedDocumentUrl,
} from "./cim-drive";
import type { Deal, DocumentRecord } from "./types";

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

export function isGeneratedPacketFile(
  document: Pick<DocumentRecord, "name"> & { url?: string }
) {
  return isDumpDocument(document);
}

export function isPrimaryCimDocument(document: DocumentRecord) {
  if (isDumpDocument(document)) return false;
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

export function listedDocuments(deal: Deal, primary?: DocumentRecord | null) {
  return secondaryDocuments(deal, primary).filter(
    (document) => !isDumpDocument(document)
  );
}

export function dumpDocuments(deal: Deal) {
  return deal.documents.filter(isDumpDocument);
}

export function documentClickUrl(
  dealId: string,
  document: DocumentRecord,
  origin?: string
) {
  const stored = storedDocumentUrl(document);
  if (stored) return stored;
  if (document.blobPathname) {
    const path = `/api/deals/${dealId}/documents/${document.id}`;
    if (origin) return `${origin.replace(/\/$/, "")}${path}`;
    return path;
  }
  return undefined;
}

export function withClickableDocumentUrls(deal: Deal, origin?: string): Deal {
  const href = openCimUrl(deal);
  return {
    ...deal,
    ...(href ? { cimDriveUrl: href } : {}),
    documents: deal.documents.map((document) => {
      const url = documentClickUrl(deal.id, document, origin);
      return {
        ...document,
        ...(url ? { url } : { url: document.url }),
        contentType: document.contentType || contentTypeForName(document.name),
      };
    }),
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
    url: storedDocumentUrl(document) || document.url,
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
          (current as Record<string, unknown>)[key] =
            key === "url" ? persistableCimDriveUrl(patch.url) || patch.url : patch[key];
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
      url: persistableCimDriveUrl(patch.url) || patch.url,
      blobPathname: patch.blobPathname,
      blobUrl: patch.blobUrl,
      contentType: patch.contentType,
    });
  }
  return next;
}

