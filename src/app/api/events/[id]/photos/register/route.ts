import crypto from "crypto";
import path from "path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  downloadFromDrive,
  driveConnected,
  driveFileMeta,
  drivePreviewFolder,
  eventDriveFolder,
  uploadToDrive,
} from "@/lib/drive";
import { deriveImages, extractEmbeddedJpeg, isRawFile, MAX_FILE_BYTES } from "@/lib/storage";
import { brandingFor } from "@/lib/studio";
import { descriptorFor } from "@/lib/face";
import { autoTagEvent } from "@/lib/face-tags";
import { publish } from "@/lib/gallery-events";

export const maxDuration = 300;

/**
 * Registers a photo the browser already uploaded straight to Google Drive.
 *
 * We never receive the original bytes over HTTP (Vercel rejects bodies over
 * 4.5 MB); we download the file from Drive server-side, build the watermark
 * thumbnail/preview, put those next to the original in `_previews`, and only
 * then create the Photo row. Clients therefore never see half-uploaded photos.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const event = await prisma.event.findFirst({
    where: { id, userId: user.id },
    select: { id: true, title: true, driveFolderId: true },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const link = await driveConnected(user.id);
  if (!link || link.status !== "CONNECTED") {
    return NextResponse.json(
      { error: "Connect Google Drive to upload photos", code: "DRIVE_REQUIRED" },
      { status: 409 },
    );
  }

  let payload: { driveFileId?: unknown; name?: unknown; size?: unknown; type?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const driveFileId = String(payload.driveFileId ?? "");
  if (!driveFileId) return NextResponse.json({ error: "Missing file id" }, { status: 400 });

  const existing = await prisma.photo.findFirst({
    where: { eventId: event.id, driveFileId },
    select: { id: true, originalName: true, thumbDriveFileId: true, previewDriveFileId: true },
  });
  if (existing) {
    return NextResponse.json({
      photo: {
        id: existing.id,
        originalName: existing.originalName,
        hasThumb: !!existing.thumbDriveFileId,
        hasPreview: !!existing.previewDriveFileId,
      },
    });
  }

  // Verify the file exists in this studio's Drive and belongs to this event.
  let meta: Awaited<ReturnType<typeof driveFileMeta>>;
  try {
    meta = await driveFileMeta(user.id, driveFileId);
  } catch {
    return NextResponse.json({ error: "Uploaded file was not found in Drive" }, { status: 400 });
  }
  if (meta.trashed) {
    return NextResponse.json({ error: "Uploaded file is in the Drive trash" }, { status: 400 });
  }

  const folderId = await eventDriveFolder(user.id, event);
  if (meta.parents && !meta.parents.includes(folderId)) {
    return NextResponse.json({ error: "File is not inside this event folder" }, { status: 400 });
  }

  const originalName = String(payload.name ?? meta.name ?? "photo").slice(0, 200);
  const mimeType = String(payload.type ?? meta.mimeType ?? "application/octet-stream");
  const sizeBytes = Number(meta.size ?? payload.size ?? 0);
  if (sizeBytes > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `${originalName}: larger than 25 MB` }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await downloadFromDrive(user.id, driveFileId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read the Drive file" },
      { status: 502 },
    );
  }

  const raw = isRawFile(originalName);
  const ext = path.extname(originalName).toLowerCase() || (raw ? ".raw" : ".jpg");
  const filename = `${crypto.randomUUID()}${ext}`;
  const branding = await brandingFor(user.id);
  const derived = await deriveImages(buffer, raw, {
    text: branding.text,
    logoPath: branding.logoPath,
  });

  // Derivatives live in Drive too (Drive-only mode).
  let thumbDriveFileId: string | null = null;
  let previewDriveFileId: string | null = null;
  try {
    const previewFolder = await drivePreviewFolder(user.id, folderId);
    if (derived.thumb) {
      thumbDriveFileId = await uploadToDrive(
        user.id,
        derived.thumb,
        `${filename}.thumb.webp`,
        previewFolder,
        "image/webp",
      );
    }
    if (derived.preview) {
      previewDriveFileId = await uploadToDrive(
        user.id,
        derived.preview,
        `${filename}.preview.webp`,
        previewFolder,
        "image/webp",
      );
    }
  } catch {
    // The original is safe; a gallery without a thumb is better than a failed upload.
  }

  const photo = await prisma.photo.create({
    data: {
      eventId: event.id,
      filename,
      originalName,
      mimeType: raw ? "application/octet-stream" : mimeType,
      sizeBytes,
      width: derived.width,
      height: derived.height,
      thumbDriveFileId,
      previewDriveFileId,
      isRaw: raw,
      originalStore: "DRIVE",
      driveFileId,
      driveFolderId: folderId,
      status: "READY",
    },
    select: {
      id: true,
      originalName: true,
      thumbDriveFileId: true,
      previewDriveFileId: true,
      width: true,
      height: true,
      isRaw: true,
    },
  });

  // Face search indexing is best-effort and must not fail the upload.
  try {
    const source = raw ? extractEmbeddedJpeg(buffer) : buffer;
    const vector = source ? await descriptorFor(source) : null;
    if (vector) {
      await prisma.faceDescriptor.create({
        data: { photoId: photo.id, vector: JSON.stringify(vector) },
      });
    }
  } catch {
    // Ignore indexing failures.
  }

  await autoTagEvent(event.id).catch(() => null);

  // Tell open galleries that a new photo is ready (same behaviour as the
  // multipart route, so clients see photos arrive live).
  const latest = await prisma.selectionEvent.create({
    data: {
      eventId: event.id,
      kind: "photo-ready",
      photoIds: JSON.stringify([photo.id]),
      actor: "studio",
    },
    select: { id: true, createdAt: true },
  });
  publish({
    id: latest.id,
    eventId: event.id,
    kind: "photo-ready",
    photoIds: [photo.id],
    actor: "studio",
    at: latest.createdAt.toISOString(),
  });

  return NextResponse.json({
    photo: {
      id: photo.id,
      originalName: photo.originalName,
      hasThumb: !!photo.thumbDriveFileId,
      hasPreview: !!photo.previewDriveFileId,
      width: photo.width,
      height: photo.height,
      isRaw: photo.isRaw,
    },
  });
}
