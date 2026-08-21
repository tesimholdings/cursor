import {
  BlobPreconditionFailedError,
  get,
  put,
} from "@vercel/blob";
import type { Store } from "./types";

const STORE_PATHNAME = "acquisition-command-center/store-v1.json";

export interface BlobConfiguration {
  configured: boolean;
  oidcToken: boolean;
  storeId: boolean;
  readWriteToken: boolean;
}

export interface BlobStoreState {
  store: Store | null;
  etag: string | null;
}

export function blobConfiguration(
  env: Readonly<Record<string, string | undefined>> = process.env
): BlobConfiguration {
  const oidcToken = Boolean(env.VERCEL_OIDC_TOKEN);
  const storeId = Boolean(env.BLOB_STORE_ID);
  const readWriteToken = Boolean(env.BLOB_READ_WRITE_TOKEN);
  return {
    configured: readWriteToken || (oidcToken && storeId),
    oidcToken,
    storeId,
    readWriteToken,
  };
}

export async function readBlobStore(): Promise<BlobStoreState> {
  const result = await get(STORE_PATHNAME, {
    access: "private",
    useCache: false,
    abortSignal: AbortSignal.timeout(15_000),
  });
  if (!result) return { store: null, etag: null };
  if (result.statusCode !== 200) {
    throw new Error(`Unexpected Blob status ${result.statusCode}`);
  }
  const text = await new Response(result.stream).text();
  return {
    store: JSON.parse(text) as Store,
    etag: result.blob.etag,
  };
}

export async function writeBlobStore(
  store: Store,
  etag: string | null
): Promise<string> {
  const result = await put(STORE_PATHNAME, JSON.stringify(store), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: etag !== null,
    ifMatch: etag || undefined,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    abortSignal: AbortSignal.timeout(15_000),
  });
  return result.etag;
}

export function isBlobConflict(error: unknown) {
  return (
    error instanceof BlobPreconditionFailedError ||
    (error instanceof Error &&
      (error.name === "BlobPreconditionFailedError" ||
        /precondition|etag|already exists/i.test(error.message)))
  );
}

export function blobLocation() {
  return `vercel-blob://${STORE_PATHNAME}`;
}
