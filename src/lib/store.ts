import fs from "fs";
import path from "path";
import os from "os";
import type { Store } from "./types";
import { seedStore } from "./seed";

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
  location: string;
  note: string;
  error?: string;
}

export function storePersistence(): StorePersistence {
  const writable = durable;
  return {
    durable: writable && !EPHEMERAL_DIR,
    location: STORE_PATH,
    note: !writable
      ? "Deal data is held in memory only because this filesystem is read-only. Uploads and screens reset when the instance recycles."
      : EPHEMERAL_DIR
        ? "Deal data is written to this instance's temporary storage. Uploads and screens reset on redeploy or when the instance recycles. Set ACC_DATA_DIR to a persistent path to keep them."
        : "Deal data is written to disk and survives restarts.",
    error: lastPersistError,
  };
}

function persist(store: Store) {
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

export async function readStore(): Promise<Store> {
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
  persist(seeded);
  return seeded;
}

export async function writeStore(store: Store) {
  cache = store;
  persist(store);
}

export async function updateStore<T>(
  fn: (store: Store) => T | Promise<T>
): Promise<T> {
  const run = queue.then(async () => {
    const store = await readStore();
    const result = await fn(store);
    await writeStore(store);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
