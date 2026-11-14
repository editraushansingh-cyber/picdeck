import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  storePhoto,
  MAX_BATCH,
  extractEmbeddedJpeg,
  storedOriginalSink,
  type OriginalSink,
} from "@/lib/storage";
import { descriptorFor } from "@/lib/face";
import { brandingFor } from "@/lib/studio";
import { autoTagEvent } from "@/lib/face-tags";
import { driveConnected, ensureFolderFor, uploadToDrive } from "@/lib/drive";
import { publish } from "@/lib/gallery-events";

export const maxDuration = 300;

/**
 * Decides where the originals for this event go.
 *
 * - Studio has Drive connected → originals are uploaded to
 *   "PicDeck / <event title>" in that studio's own Drive (drive.file scope).
 * - Drive fails or is not connected → the file is written to local disk so an
 *   upload never fails silently; the photo row records which store it used.
 *
 * Thumbnails and watermarked previews always stay on the app server.
 */
async function originalSinkFor(userId: string, eventId: string, title: string): Promise<OriginalSink> {
  const local = storedOriginalSink(eventId);
  const link = await driveConnected(userId);
  if (!link || link.status !== "CONNECTED") return local;

  let folderId: string | null = null;
  try {
    folderId = await ensureFolderFor(userId, null, "PicDeck");
    const eventFolder = await ensureFolderFor(userId, folderId, title);
    folderId = eventFolder;
    if (eventFolder) {
      await prisma.event.update({ where: { id: eventId }, data: { driveFolderId: eventFolder } });
    }
  } catch {
    return local;
  }

  const target = folderId;
  return {
    async save(name, buffer, mimeType) {
      try {
        const fileId = await uploadToDrive(userId, buffer, name, target, mimeType);
        return { store: "DRIVE", fileId };
      } catch (error) {
        // Never lose a client photo because Drive hiccupped: keep the local copy.
        const fallback = await local.save(name, buffer, mimeType);
        return {
          store: "LOCAL",
          fileId: null,
          localPath: fallback.localPath ?? null,
          error: error instanceof Error ? error.message : "Drive upload failed",
        };
      }
    },
  };
}

export async function POST(request: Request, context: RouteContext<"/api/events/[id]/photos">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const event = await prisma.event.findFirst({ where: { id, userId: user.id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "No files" }, { status: 400 });
  if (files.length > MAX_BATCH) {
    return NextResponse.json({ error: `Upload at most ${MAX_BATCH} files at a time` }, { status: 400 });
  }

  const stored = [];
  const failed: { name: string; reason: string }[] = [];
  const branding = await brandingFor(user.id);
  const sink = await originalSinkFor(user.id, event.id, event.title);

  for (const file of files) {
    const result = await storePhoto(
      event.id,
      file,
      { text: branding.text, logoPath: branding.logoPath },
      sink,
    );
    if ("error" in result) {
      failed.push({ name: file.name, reason: result.error });
      continue;
    }
    const photo = await prisma.photo.create({
      data: {
        eventId: event.id,
        filename: result.filename,
        originalName: result.originalName,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
        width: result.width,
        height: result.height,
        thumbPath: result.thumbPath,
        previewPath: result.previewPath,
        isRaw: result.isRaw,
        originalStore: result.originalStore,
        driveFileId: result.driveFileId,
        localOriginalPath: result.originalPath,
        // The original write already resolved above, so the photo is publishable
        // the moment the row exists. CamTom does the same: it writes its
        // `photoUploaded` flag only after the Drive insert succeeds.
        status: "READY",
        // The event folder is created lazily; read it once the first original lands.
        driveFolderId:
          result.originalStore === "DRIVE"
            ? ((await prisma.event.findUnique({
                where: { id: event.id },
                select: { driveFolderId: true },
              }))?.driveFolderId ?? null)
            : null,
      },
      select: {
        id: true,
        originalName: true,
        thumbPath: true,
        isRaw: true,
        width: true,
        height: true,
        originalStore: true,
      },
    });

    // Index the photo for face/similarity search from the in-memory copy, so
    // indexing does not depend on where the original ended up.
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const source = result.isRaw ? extractEmbeddedJpeg(buffer) : buffer;
      const vector = source ? await descriptorFor(source) : null;
      if (vector) {
        await prisma.faceDescriptor.create({
          data: { photoId: photo.id, vector: JSON.stringify(vector) },
        });
      }
    } catch {
      // Indexing is best-effort; the upload itself succeeded.
    }

    stored.push(photo);
  }

  if (stored.length > 0) {
    await autoTagEvent(event.id).catch(() => null);

    // Tell every open gallery that new photos are ready, so a client watching
    // the link while the studio uploads sees them arrive (CamTom shows a photo
    // only after its Drive upload resolves, and so do we).
    const latest = await prisma.selectionEvent.create({
      data: {
        eventId: event.id,
        kind: "photo-ready",
        photoIds: JSON.stringify(stored.map((photo) => photo.id)),
        actor: "studio",
      },
      select: { id: true, createdAt: true },
    });
    publish({
      id: latest.id,
      eventId: event.id,
      kind: "photo-ready",
      photoIds: stored.map((photo) => photo.id),
      actor: "studio",
      at: latest.createdAt.toISOString(),
    });
  }

  return NextResponse.json({ stored: stored.length, photos: stored, failed });
}