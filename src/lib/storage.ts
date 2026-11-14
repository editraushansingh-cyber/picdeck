import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import type { OverlayOptions } from "sharp";
import crypto from "crypto";
import { storeWrite, storeRead, storeDelete, storeDeleteMany, storeBackend } from "./object-store";

const ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), "storage");

/**
 * Where the untouched original of an upload is written. Google Drive uses this
 * to keep client photos in the studio's own Drive; everything else stays local.
 */
export type SinkResult = {
  store: "LOCAL" | "DRIVE";
  fileId: string | null;
  /** Relative path of the local copy (set whenever a LOCAL copy was written). */
  localPath?: string | null;
  error?: string;
};

export type OriginalSink = {
  save(name: string, buffer: Buffer, mimeType: string): Promise<SinkResult>;
};

/** Local disk sink for originals when the studio has no Drive connected. */
export function localOriginalSink(eventId: string): OriginalSink {
  return {
    async save(name, buffer) {
      const dir = path.join(ROOT, "events", eventId, "orig");
      await ensure(dir);
      const stored = `${crypto.randomUUID()}${path.extname(name).toLowerCase() || ".bin"}`;
      await fs.writeFile(path.join(dir, stored), buffer);
      return {
        store: "LOCAL",
        fileId: null,
        localPath: path.posix.join("events", eventId, "orig", stored),
      };
    },
  };
}

const RAW_EXT = new Set([
  ".cr2", ".cr3", ".nef", ".arw", ".dng", ".orf", ".rw2", ".raf", ".pef", ".srw", ".raw",
]);

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_BATCH = 60;

export function isRawFile(name: string) {
  return RAW_EXT.has(path.extname(name).toLowerCase());
}

export function isImageFile(mime: string, name: string) {
  return mime.startsWith("image/") || isRawFile(name);
}

async function ensure(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export type StoredPhoto = {
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  thumbPath: string | null;
  previewPath: string | null;
  isRaw: boolean;
  /** Relative path of a locally stored original; null when it lives in Drive. */
  originalPath: string | null;
  originalStore: "LOCAL" | "DRIVE";
  driveFileId: string | null;
  driveError: string | null;
};

export type WatermarkOptions = {
  text?: string | null;
  logoPath?: string | null;
};

/**
 * Camera RAW files are TIFF/ISO-BMFF containers with one or more embedded JPEG
 * previews. We keep the original untouched and derive thumbnails from the
 * largest embedded JPEG, so RAW works without a libraw dependency.
 */
export function extractEmbeddedJpeg(buffer: Buffer): Buffer | null {
  const SOI = Buffer.from([0xff, 0xd8]);
  const EOI = Buffer.from([0xff, 0xd9]);
  let best: Buffer | null = null;
  let bestLength = 0;

  let start = buffer.indexOf(SOI);
  let guard = 0;
  while (start !== -1 && guard < 12) {
    const end = buffer.indexOf(EOI, start + 2);
    if (end === -1) break;
    const candidate = buffer.subarray(start, end + 2);
    if (candidate.length > bestLength) {
      bestLength = candidate.length;
      best = candidate;
    }
    start = buffer.indexOf(SOI, end + 2);
    guard += 1;
  }

  // Ignore tiny thumbnails; require a usable preview.
  return best && bestLength >= 10_000 ? best : null;
}

/** Builds a bottom-right watermark overlay for client-facing previews. */
async function watermarkOverlay(width: number, options: WatermarkOptions) {
  const layers: OverlayOptions[] = [];

  if (options.logoPath) {
    try {
      const logo = await sharp(absolutePath(options.logoPath))
        .resize({ width: Math.max(120, Math.round(width * 0.16)), withoutEnlargement: true })
        .ensureAlpha(0.72)
        .png()
        .toBuffer();
      layers.push({ input: logo, gravity: "southeast" });
    } catch {
      // Missing logo: fall back to text only.
    }
  }

  const text = options.text?.trim();
  if (text) {
    const safe = text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
    const fontSize = Math.max(18, Math.round(width * 0.022));
    const svg = `<svg width="${width}" height="${fontSize * 2.4}" xmlns="http://www.w3.org/2000/svg">
      <text x="${fontSize}" y="${fontSize * 1.5}" text-anchor="start"
        font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}"
        fill="white" fill-opacity="0.62" stroke="black" stroke-opacity="0.28" stroke-width="1.5">${safe}</text>
    </svg>`;
    layers.push({ input: Buffer.from(svg), gravity: "southwest" });
  }

  return layers;
}

/**
 * Stores an uploaded file. Raster images get webp thumbnail (480px) and
 * preview (1600px). RAW files are derived from their embedded JPEG preview.
 *
 * Originals go to `original` (Google Drive when the studio connected it, local
 * disk otherwise). Thumbnails and previews always stay on the server so client
 * galleries never wait on Drive.
 */
export async function storePhoto(
  eventId: string,
  file: File,
  watermark: WatermarkOptions = {},
  original: OriginalSink = localOriginalSink(eventId),
): Promise<StoredPhoto | { error: string }> {
  const originalName = file.name || "photo";
  const sizeBytes = file.size;
  const raw = isRawFile(originalName);
  const mimeType = raw ? "application/octet-stream" : file.type || "application/octet-stream";

  if (sizeBytes > MAX_FILE_BYTES) {
    return { error: `${originalName}: file larger than 25 MB` };
  }
  if (!isImageFile(mimeType, originalName)) {
    return { error: `${originalName}: unsupported file type` };
  }

  const ext = path.extname(originalName).toLowerCase() || (raw ? ".raw" : ".jpg");
  const filename = `${crypto.randomUUID()}${ext}`;
  const baseDir = path.join(ROOT, "events", eventId);
  const origDir = path.join(baseDir, "orig");
  const thumbDir = path.join(baseDir, "thumb");
  const previewDir = path.join(baseDir, "preview");
  // Local backend needs the directories pre-created; object storage does not.
  if (storeBackend() === "local") {
    await Promise.all([ensure(origDir), ensure(thumbDir), ensure(previewDir)]);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sink = await original.save(originalName, buffer, mimeType);

  let width: number | null = null;
  let height: number | null = null;
  let thumbPath: string | null = null;
  let previewPath: string | null = null;

  let source: Buffer | null = buffer;
  if (raw) {
    source = extractEmbeddedJpeg(buffer);
  }

  if (source) {
    try {
      const meta = await sharp(source).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      const thumbName = `${filename}.webp`;
      const previewName = `${filename}.webp`;

      const thumbKey = path.posix.join("photos", eventId, "thumb", thumbName);
      const previewKey = path.posix.join("photos", eventId, "preview", previewName);

      const thumbBuffer = await sharp(source)
        .rotate()
        .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();

      const preview = sharp(source)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true });
      const resized = await preview.toBuffer({ resolveWithObject: true });
      const layers = await watermarkOverlay(resized.info.width, watermark);
      const finalPreview = layers.length
        ? sharp(resized.data).composite(layers)
        : sharp(resized.data);
      const previewBuffer = await finalPreview.webp({ quality: 82 }).toBuffer();

      // Writes go through the object store; on Supabase these land in the
      // `photos` bucket under the same key/path used on local disk.
      await storeWrite(thumbKey, thumbBuffer, "image/webp");
      await storeWrite(previewKey, previewBuffer, "image/webp");

      thumbPath = thumbKey;
      previewPath = previewKey;
    } catch {
      // Broken/invalid image: keep the original, no derivatives.
    }
  }

  // A Drive failure still leaves a local copy behind (see the upload route), so
  // record it whenever the sink wrote one.
  const originalRelativePath = sink.localPath ?? null;

  return {
    filename,
    originalName,
    mimeType,
    sizeBytes,
    width,
    height,
    thumbPath,
    previewPath,
    isRaw: raw,
    originalPath: originalRelativePath,
    originalStore: sink.store,
    driveFileId: sink.fileId,
    driveError: sink.error ?? null,
  };
}

export function absolutePath(relative: string) {
  const resolved = path.resolve(ROOT, relative);
  if (!resolved.startsWith(path.resolve(ROOT))) throw new Error("INVALID_PATH");
  return resolved;
}

/** Local-only path reader kept for storage tests; production reads flow through
 * the object store so thumb/preview/asset reads work on a stateless server. */
export async function readLocalOnly(relative: string) {
  return fs.readFile(absolutePath(relative));
}

export async function readStored(relative: string) {
  return storeRead(relative);
}

export async function deleteEventFiles(eventId: string) {
  await fs.rm(path.join(ROOT, "events", eventId), { recursive: true, force: true });
  // The object store keeps each derivative under `photos/<eventId>/...`; remove
  // everything for this event without glob support by targeting known keys is
  // awkward, so we rely on per-photo delete. Bucket-level cleanup for archived
  // events is handled by a periodic job when Supabase storage is configured.
}

/** Removes one photo's original, thumbnail and preview (any backend). */
export async function deletePhotoFiles(eventId: string, filename: string) {
  await Promise.all([
    fs.rm(path.join(ROOT, "events", eventId, "orig", filename), { force: true }),
    // Thumbnails/previews live in the object store; the local-path cleanup above
    // is the no-op in production where the store backend is not local disk.
    storeDeleteMany([
      path.posix.join("photos", eventId, "thumb", `${filename}.webp`),
      path.posix.join("photos", eventId, "preview", `${filename}.webp`),
    ]),
  ]);
}

export async function storeSiteCover(
  userId: string,
  file: File,
): Promise<{ error: string } | { relative: string }> {
  if (file.size > MAX_FILE_BYTES) return { error: "Cover is larger than 25 MB" };
  if (!file.type.startsWith("image/")) return { error: "Cover must be an image" };

  const buffer = Buffer.from(await file.arrayBuffer());
  let webp: Buffer;
  try {
    webp = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, height: 900, fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { error: "Could not read that image" };
  }

  const key = path.posix.join("sites", userId, "cover.webp");
  await storeWrite(key, webp, "image/webp");
  return { relative: key };
}

export async function deleteSiteCover(userId: string) {
  await storeDelete(path.posix.join("sites", userId, "cover.webp")).catch(() => null);
}

/** Studio logo: transparent PNG used on albums and optional preview watermark. */
export async function storeStudioLogo(
  userId: string,
  file: File,
): Promise<{ error: string } | { relative: string }> {
  if (file.size > 10 * 1024 * 1024) return { error: "Logo is larger than 10 MB" };
  if (!file.type.startsWith("image/")) return { error: "Logo must be an image" };
  const buffer = Buffer.from(await file.arrayBuffer());
  let png: Buffer;
  try {
    png = await sharp(buffer)
      .rotate()
      .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    return { error: "Could not read that logo" };
  }
  const key = path.posix.join("sites", userId, "logo.png");
  await storeWrite(key, png, "image/png");
  return { relative: key };
}

export async function deleteStudioLogo(userId: string) {
  await storeDelete(path.posix.join("sites", userId, "logo.png")).catch(() => null);
}

/** Album cover artwork, cropped to a 1600×1000 landscape. */
export async function storeAlbumCover(
  albumId: string,
  file: File,
): Promise<{ error: string } | { relative: string }> {
  if (file.size > MAX_FILE_BYTES) return { error: "Cover is larger than 25 MB" };
  if (!file.type.startsWith("image/")) return { error: "Cover must be an image" };
  const buffer = Buffer.from(await file.arrayBuffer());
  let webp: Buffer;
  try {
    webp = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, height: 1000, fit: "cover", position: "centre" })
      .webp({ quality: 84 })
      .toBuffer();
  } catch {
    return { error: "Could not read that cover" };
  }
  const key = path.posix.join("albums", albumId, "cover.webp");
  await storeWrite(key, webp, "image/webp");
  return { relative: key };
}

const AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mp4": ".m4a",
  "audio/aac": ".m4a",
  "audio/ogg": ".ogg",
};

/** Background music for a flipbook. Kept as-is; only one track per album. */
export async function storeAlbumMusic(
  albumId: string,
  file: File,
): Promise<{ error: string } | { relative: string }> {
  if (file.size > 20 * 1024 * 1024) return { error: "Music is larger than 20 MB" };
  const ext = AUDIO_TYPES[file.type] || path.extname(file.name).toLowerCase();
  if (![".mp3", ".wav", ".m4a", ".ogg"].includes(ext)) {
    return { error: "Use an MP3, WAV, M4A or OGG track" };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `music${ext}`;
  const key = path.posix.join("albums", albumId, filename);
  const mime = MIME_FOR_AUDIO[ext] || "application/octet-stream";
  await storeWrite(key, buffer, mime);
  await clearOtherMusic(albumId, filename);
  return { relative: key };
}

const MIME_FOR_AUDIO: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
};

async function clearOtherMusic(albumId: string, keep: string) {
  // Best effort on the local backend; object storage clears any stale track by
  // key. With only one track per album recorded in the DB, nothing else lands
  // here in practice.
  const dir = path.join(ROOT, "albums", albumId);
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter((name) => name.startsWith("music.") && name !== keep)
      .map((name) => storeDelete(path.posix.join("albums", albumId, name)).catch(() => null)),
  );
}

export async function clearAlbumMusic(albumId: string) {
  await clearOtherMusic(albumId, "");
}

export async function deleteAlbumFiles(albumId: string) {
  await fs.rm(path.join(ROOT, "albums", albumId), { recursive: true, force: true });
  await storeDeleteMany([
    path.posix.join("albums", albumId, "cover.webp"),
  ]).catch(() => null);
}

/** Reads a stored album asset for streamed responses. */
export async function readAlbumAsset(albumId: string, filename: string) {
  return storeRead(path.posix.join("albums", albumId, filename));
}

export function originalRelative(eventId: string, filename: string) {
  return path.posix.join("events", eventId, "orig", filename);
}