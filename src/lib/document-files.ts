import fs from "fs";
import os from "os";
import path from "path";
import { get, put } from "@vercel/blob";
import { blobConfiguration } from "./blob-store";
import { contentTypeForName } from "./documents";
import type { DocumentRecord } from "./types";

function documentsRoot() {
  if (process.env.ACC_DATA_DIR) {
    return path.join(process.env.ACC_DATA_DIR, "documents");
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "acquisition-command-center", "documents");
  }
  return path.join(process.cwd(), "data", "documents");
}

export function documentBlobPathname(
  dealId: string,
  documentId: string,
  fileName: string
) {
  const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 180) || "file";
  return `acquisition-command-center/documents/${dealId}/${documentId}/${safe}`;
}

export async function persistDocumentBytes(
  dealId: string,
  documentId: string,
  fileName: string,
  buffer: Buffer,
  contentType = contentTypeForName(fileName)
): Promise<{ blobPathname?: string; blobUrl?: string; url?: string }> {
  const blobPathname = documentBlobPathname(dealId, documentId, fileName);
  if (blobConfiguration().configured) {
    const result = await put(blobPathname, buffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
      abortSignal: AbortSignal.timeout(30_000),
    });
    return {
      blobPathname,
      blobUrl: result.url,
      url: result.url,
    };
  }
  const localPath = path.join(documentsRoot(), dealId, documentId, path.basename(blobPathname));
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);
  return { blobPathname, url: `/api/deals/${dealId}/documents/${documentId}` };
}

export async function readDocumentBytes(options: {
  dealId: string;
  documentId: string;
  blobPathname?: string;
  blobUrl?: string;
  fileName?: string;
}): Promise<{ bytes: Buffer; contentType: string } | null> {
  const contentType = contentTypeForName(options.fileName || "file.bin");
  const localCandidates = [
    options.blobPathname
      ? path.join(
          documentsRoot(),
          options.dealId,
          options.documentId,
          path.basename(options.blobPathname)
        )
      : "",
    path.join(documentsRoot(), options.dealId, options.documentId),
  ].filter(Boolean);
  for (const candidate of localCandidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return { bytes: fs.readFileSync(candidate), contentType };
      }
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        const files = fs.readdirSync(candidate);
        if (files[0]) {
          return {
            bytes: fs.readFileSync(path.join(candidate, files[0])),
            contentType,
          };
        }
      }
    } catch {
      // Fall through to blob.
    }
  }

  const pathname = options.blobPathname;
  if (pathname && blobConfiguration().configured) {
    try {
      const result = await get(pathname, {
        access: "public",
        abortSignal: AbortSignal.timeout(20_000),
      });
      if (result && result.statusCode === 200) {
        const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
        return { bytes, contentType };
      }
    } catch {
      // Public get can fail for older private objects; try the stored URL.
    }
  }
  if (options.blobUrl) {
    try {
      const response = await fetch(options.blobUrl, {
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) {
        return {
          bytes: Buffer.from(await response.arrayBuffer()),
          contentType:
            response.headers.get("content-type") || contentType,
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function storeUploadedDocument(
  record: Omit<
    DocumentRecord,
    "url" | "blobPathname" | "blobUrl" | "contentType"
  > & { buffer: Buffer }
): Promise<DocumentRecord> {
  const contentType = contentTypeForName(record.name);
  const { buffer, ...document } = record;
  try {
    const stored = await persistDocumentBytes(
      document.dealId,
      document.id,
      document.name,
      buffer,
      contentType
    );
    return { ...document, ...stored, contentType };
  } catch {
    return { ...document, contentType };
  }
}
