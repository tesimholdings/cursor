import {
  BlobPreconditionFailedError,
  get,
  put,
} from "@vercel/blob";
import { getVercelOidcToken, getVercelOidcTokenSync } from "@vercel/oidc";
import type { Store } from "./types";

const STORE_PATHNAME = "acquisition-command-center/store-v1.json";

export type BlobCredentialSource =
  | "read-write-token"
  | "vercel-oidc"
  | "none";

export interface BlobConfiguration {
  configured: boolean;
  source: BlobCredentialSource;
  onVercel: boolean;
  storeId: boolean;
  oidcTokenInEnv: boolean;
  readWriteToken: boolean;
}

export interface BlobStoreState {
  store: Store | null;
  etag: string | null;
}

export function blobConfiguration(
  env: Readonly<Record<string, string | undefined>> = process.env
): BlobConfiguration {
  const readWriteToken = Boolean(env.BLOB_READ_WRITE_TOKEN);
  const storeId = Boolean(env.BLOB_STORE_ID);
  const oidcTokenInEnv = Boolean(env.VERCEL_OIDC_TOKEN);
  const onVercel = Boolean(env.VERCEL);
  // A connected OIDC store does not put VERCEL_OIDC_TOKEN in process.env: the
  // SDK reads the per-request `x-vercel-oidc-token` header and only falls back
  // to the environment variable. So on Vercel the store id is the real signal,
  // and requiring the env var reported a connected store as unconfigured.
  const oidc = storeId && (onVercel || oidcTokenInEnv);
  return {
    configured: readWriteToken || oidc,
    source: readWriteToken
      ? "read-write-token"
      : oidc
        ? "vercel-oidc"
        : "none",
    onVercel,
    storeId,
    oidcTokenInEnv,
    readWriteToken,
  };
}

export type BlobCredentialProbe =
  | { available: true; source: BlobCredentialSource }
  | { available: false; source: BlobCredentialSource; reason: string };

// Asks the SDK for a real credential instead of inferring one from env vars, so
// a broken OIDC federation is reported as a token error rather than as "not
// connected". Only presence is checked here; whether the credential is accepted
// is decided by the actual Blob read/write and reported through its own error.
export async function probeBlobCredential(): Promise<BlobCredentialProbe> {
  const config = blobConfiguration();
  if (config.source === "read-write-token") {
    return { available: true, source: config.source };
  }
  if (config.source === "none") {
    return {
      available: false,
      source: config.source,
      reason: "No Blob store id and no read/write token are present.",
    };
  }
  // The sync read takes the per-request header without attempting a refresh, so
  // a valid token that is merely close to expiry is not reported as missing.
  try {
    if (getVercelOidcTokenSync()) {
      return { available: true, source: config.source };
    }
  } catch {
    // Fall through to the refreshing variant, which is what local development
    // needs after `vercel env pull`.
  }
  try {
    const token = await getVercelOidcToken();
    if (token) return { available: true, source: config.source };
    return {
      available: false,
      source: config.source,
      reason: "Vercel returned an empty OIDC token for this request.",
    };
  } catch (error) {
    return {
      available: false,
      source: config.source,
      reason:
        error instanceof Error
          ? error.message
          : "Unknown Vercel OIDC token error",
    };
  }
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
