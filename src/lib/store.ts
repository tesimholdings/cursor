import fs from "fs";
import path from "path";
import os from "os";
import type { Store } from "./types";
import { seedStore } from "./seed";
import {
  blobConfiguration,
  blobLocation,
  isBlobConflict,
  probeBlobCredential,
  readBlobStore,
  writeBlobStore,
  type BlobConfiguration,
  type BlobCredentialProbe,
} from "./blob-store";

// Hosted serverless filesystems are read-only apart from a temp directory, so
// the data directory has to be resolved per environment instead of assuming the
// repository is writable. A temp directory accepts writes but is discarded when
// the instance recycles, so it is tracked as ephemeral rather than durable.
function resolveDataDir(): { dir: string; ephemeral: boolean } {
  if (process.env.ACC_DATA_DIR) {
    return { dir: process.env.ACC_DATA_DIR, ephemeral: false };
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return {
      dir: path.join(os.tmpdir(), "acquisition-command-center"),
      ephemeral: true,
    };
  }
  return { dir: path.join(process.cwd(), "data"), ephemeral: false };
}

const { dir: DATA_DIR, ephemeral: EPHEMERAL_DIR } = resolveDataDir();
const STORE_PATH = path.join(DATA_DIR, "store.json");

let cache: Store | null = null;
let durable = true;
let lastPersistError: string | undefined;
let queue: Promise<unknown> = Promise.resolve();

export interface StorePersistence {
  durable: boolean;
  backend: "vercel-blob" | "filesystem" | "memory";
  location: string;
  note: string;
  error?: string;
  configuration: BlobConfiguration;
  credential?: BlobCredentialProbe;
}

function unsharedNote(blob: BlobConfiguration): string {
  if (!durable) {
    return "Deal data is held in memory only because this filesystem is read-only. Uploads and screens reset when the instance recycles.";
  }
  if (!EPHEMERAL_DIR) {
    return "Deal data is written to disk and survives restarts.";
  }
  // On Vercel a store id alone counts as configured, so reaching here means no
  // store is connected at all.
  if (blob.onVercel) {
    return "No Vercel Blob store is connected to this project, so each serverless instance uses its own temporary copy. A company added now can vanish on refresh. Connect a private Blob store to Preview and Production, then redeploy.";
  }
  return blob.storeId
    ? "A Blob store id is present but no local Blob credential is available. Run `vercel env pull` to work against the shared store locally; until then this is temporary storage."
    : "Deal data is written to this instance's temporary storage. Uploads and screens reset on redeploy or when the instance recycles.";
}

export function storePersistence(
  credential?: BlobCredentialProbe
): StorePersistence {
  const blob = blobConfiguration();
  if (blob.configured) {
    const credentialFailure =
      credential && !credential.available ? credential.reason : undefined;
    const failure = lastPersistError || credentialFailure;
    return {
      durable: !failure,
      backend: "vercel-blob",
      location: blobLocation(),
      note: failure
        ? "A Vercel Blob store is connected but this request could not use it, so deal data is not shared right now. The underlying error is reported below."
        : blob.source === "vercel-oidc"
          ? "Deal data is shared in the connected private Vercel Blob store using rotating OIDC credentials, so every serverless instance sees the same board."
          : "Deal data is shared in the connected private Vercel Blob store, so every serverless instance sees the same board.",
      error: failure,
      configuration: blob,
      credential,
    };
  }
  return {
    durable: durable && !EPHEMERAL_DIR,
    backend: durable ? "filesystem" : "memory",
    location: STORE_PATH,
    note: unsharedNote(blob),
    error: lastPersistError,
    configuration: blob,
    credential,
  };
}

// Async companion to `storePersistence` that asks the SDK for a real credential
// instead of inferring one from environment variables.
export async function storeStatus(): Promise<StorePersistence> {
  const blob = blobConfiguration();
  if (!blob.configured) return storePersistence();
  return storePersistence(await probeBlobCredential());
}

function persistLocal(store: Store) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
    durable = true;
    lastPersistError = undefined;
  } catch (error) {
    // Keep serving from memory rather than failing the request.
    durable = false;
    lastPersistError =
      error instanceof Error ? error.message : "Unknown persistence error";
  }
}

async function readLocalStore(): Promise<Store> {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Store;
    return cache;
  } catch (error) {
    lastPersistError =
      error instanceof Error ? error.message : "Unreadable store file";
  }
  const seeded = seedStore();
  cache = seeded;
  persistLocal(seeded);
  return seeded;
}

async function writeLocalStore(store: Store) {
  cache = store;
  persistLocal(store);
}

async function readOrCreateBlobStore() {
  const current = await readBlobStore();
  if (current.store) return { store: current.store, etag: current.etag! };

  const seeded = seedStore();
  try {
    const etag = await writeBlobStore(seeded, null);
    return { store: seeded, etag };
  } catch (error) {
    if (!isBlobConflict(error)) throw error;
    const raced = await readBlobStore();
    if (!raced.store || !raced.etag) {
      throw new Error("Blob store initialization raced but no store was found.");
    }
    return { store: raced.store, etag: raced.etag };
  }
}

export async function readStore(): Promise<Store> {
  if (!blobConfiguration().configured) return readLocalStore();
  try {
    const state = await readOrCreateBlobStore();
    lastPersistError = undefined;
    return state.store;
  } catch (error) {
    lastPersistError =
      error instanceof Error ? error.message : "Unknown Vercel Blob read error";
    throw error;
  }
}

export async function updateStore<T>(
  fn: (store: Store) => T | Promise<T>
): Promise<T> {
  if (blobConfiguration().configured) {
    const run = queue.then(async () => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const state = await readOrCreateBlobStore();
        const result = await fn(state.store);
        try {
          await writeBlobStore(state.store, state.etag);
          lastPersistError = undefined;
          return result;
        } catch (error) {
          if (isBlobConflict(error) && attempt < 5) continue;
          lastPersistError =
            error instanceof Error
              ? error.message
              : "Unknown Vercel Blob write error";
          throw error;
        }
      }
      throw new Error("Vercel Blob update retries exhausted.");
    });
    queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  const run = queue.then(async () => {
    const store = await readLocalStore();
    const result = await fn(store);
    await writeLocalStore(store);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
