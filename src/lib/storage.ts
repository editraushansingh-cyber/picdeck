import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import crypto from "crypto";

const ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), "storage");

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
};

/**
 * Stores an uploaded file. Raster images get webp thumbnail (480px) and
 * preview (1600px). RAW files are stored as-is with no derivatives.
 */
export async function storePhoto(
  eventId: string,
  file: File,
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
  await Promise.all([ensure(origDir), ensure(thumbDir), ensure(previewDir)]);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(origDir, filename), buffer);

  let width: number | null = null;
  let height: number | null = null;
  let thumbPath: string | null = null;
  let previewPath: string | null = null;

  if (!raw) {
    try {
      const meta = await sharp(buffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      const thumbName = `${filename}.webp`;
      const previewName = `${filename}.webp`;
      await sharp(buffer)
        .rotate()
        .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(path.join(thumbDir, thumbName));
      await sharp(buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path.join(previewDir, previewName));
      thumbPath = path.posix.join("events", eventId, "thumb", thumbName);
      previewPath = path.posix.join("events", eventId, "preview", previewName);
    } catch {
      // Broken/invalid image: keep the original, no derivatives.
    }
  }

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
  };
}

export function absolutePath(relative: string) {
  const resolved = path.resolve(ROOT, relative);
  if (!resolved.startsWith(path.resolve(ROOT))) throw new Error("INVALID_PATH");
  return resolved;
}

export async function readStored(relative: string) {
  return fs.readFile(absolutePath(relative));
}

export async function deleteEventFiles(eventId: string) {
  await fs.rm(path.join(ROOT, "events", eventId), { recursive: true, force: true });
}

export function originalRelative(eventId: string, filename: string) {
  return path.posix.join("events", eventId, "orig", filename);
}