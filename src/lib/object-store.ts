import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Object-store abstraction over photo/album/site derivatives.
 *
 * Two backends share one interface so dev works on local disk (fast, no setup)
 * and production reads/writes managed storage (Supabase Storage on Vercel,
 * where the filesystem is stateless). The caller chooses with STORAGE_PROVIDER:
 *
 *   STORAGE_PROVIDER=local     (default, dev)
 *   STORAGE_PROVIDER=supabase (production)
 *
 * Keys are `type/...` namespaced, e.g. `photos/<eventId>/thumb/<name>.webp` or
 * `assets/<userId>/logo.png`. Files written here are immutable once created
 * (new uploads create new keys), so reads can be cached hard.
 */

const LOCAL_ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), "storage");

export type ObjectStoreBackend = "local" | "supabase";

export function storeBackend(): ObjectStoreBackend {
  return process.env.STORAGE_PROVIDER === "supabase" ? "supabase" : "local";
}

export function storeConfigured(backend?: ObjectStoreBackend): boolean {
  const b = backend ?? storeBackend();
  if (b === "local") return true;
  // Supabase is "configured" when both storage creds are present.
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
}

async function ensureLocalDir(relative: string) {
  const abs = path.join(LOCAL_ROOT, relative);
  await fs.mkdir(path.dirname(abs), { recursive: true });
}

/**
 * Writes bytes to the store. Returns the key you should persist, which is the
 * same relative path used on local disk (so `thumbPath`/`previewPath` values
 * already in the DB stay valid for both backends).
 */
export async function storeWrite(key: string, buffer: Buffer, contentType: string): Promise<string> {
  const backend = storeBackend();
  if (backend === "local") {
    const abs = localPathFor(key);
    await ensureLocalDir(key);
    await fs.writeFile(abs, buffer);
    return key;
  }
  const { supabaseAdmin } = await import("./supabase");
  const client = supabaseAdmin();
  const bucket = bucketFor(key);
  const { error } = await client.storage.from(bucket).upload(key, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`storage upload ${error.message}`);
  return key;
}

/** Streams bytes back from the store. Used for `image/` downloads and presets. */
export async function storeRead(key: string): Promise<Buffer> {
  const backend = storeBackend();
  if (backend === "local") {
    const abs = localPathFor(key);
    const resolved = path.resolve(abs);
    if (!resolved.startsWith(path.resolve(LOCAL_ROOT))) throw new Error("INVALID_PATH");
    return fs.readFile(resolved);
  }
  const { supabaseAdmin } = await import("./supabase");
  const client = supabaseAdmin();
  const raw = await client.storage.from(bucketFor(key)).download(key);
  if (raw.error) throw new Error(`storage read ${raw.error.message}`);
  const bytes = new Uint8Array(await raw.data.arrayBuffer());
  return Buffer.from(bytes);
}

/** Deletes one object. Missing objects are not an error. */
export async function storeDelete(key: string): Promise<void> {
  const backend = storeBackend();
  if (backend === "local") {
    await fs.rm(localPathFor(key), { force: true });
    return;
  }
  const { supabaseAdmin } = await import("./supabase");
  const client = supabaseAdmin();
  const { error } = await client.storage.from(bucketFor(key)).remove([key]);
  if (error) throw new Error(`storage delete ${error.message}`);
}

/** Bulk delete, best-effort (a failing key does not stop the others). */
export async function storeDeleteMany(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => storeDelete(key).catch(() => null)));
}

export function storeKeyExists(key: string): boolean {
  // Non-empty; the actual existence check happens at read time.
  return !!key;
}

function bucketFor(key: string): string {
  return key.startsWith("photos/") ? "photos" : "assets";
}

/**
 * Resolves a store key to an absolute path on the local backend. Kept private;
 * route handlers read through storeRead() so the backend choice stays central.
 */
export function localPathFor(key: string): string {
  return path.join(LOCAL_ROOT, key);
}

/** Convenience: a random key under a namespace, keeping the local extension. */
export function randomKey(namespace: string, extension: string): string {
  return path.posix.join(namespace, `${crypto.randomUUID()}${extension}`);
}