import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { isGalleryUnlocked } from "@/lib/gallery-session";
import { readStored } from "@/lib/storage";
import { downloadFromDrive } from "@/lib/drive";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg.webp": "image/webp",
  ".heic": "image/heic",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
};

export async function GET(request: Request, context: RouteContext<"/api/photos/[id]/file">) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "thumb";

  const photo = await prisma.photo.findUnique({
    where: { id },
    include: { event: true },
  });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = await getUserId();
  const isOwner = userId === photo.event.userId;
  const isClient = await isGalleryUnlocked(photo.eventId);

  if (!isOwner && !isClient) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isClient && !isOwner && photo.event.status !== "ACTIVE") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fromDrive = kind === "original" && photo.originalStore === "DRIVE" && photo.driveFileId;
  let relative: string | null = null;
  if (kind === "thumb") relative = photo.thumbPath;
  else if (kind === "preview") relative = photo.previewPath;
  else if (kind === "original") relative = fromDrive ? "drive" : photo.localOriginalPath;

  // Clients may always *view* previews; downloads follow the event settings.
  const wantsDownload = url.searchParams.get("download") === "1";
  if (kind === "original" && !isOwner) {
    if (!photo.event.originalDownloadEnabled) {
      return NextResponse.json({ error: "Original download is disabled" }, { status: 403 });
    }
  }
  if (kind !== "original" && wantsDownload && !isOwner && !photo.event.downloadEnabled) {
    return NextResponse.json({ error: "Downloads are disabled" }, { status: 403 });
  }
  if (!relative) return NextResponse.json({ error: "No preview available" }, { status: 404 });

  try {
    // Originals may live in the studio's Google Drive; derivatives come from
    // the object store (local disk in dev, Supabase Storage in production).
    const file = fromDrive
      ? await downloadFromDrive(photo.event.userId, photo.driveFileId as string)
      : await readStored(relative);
    const extension = relative.includes(".webp") ? ".webp" : relative.slice(relative.lastIndexOf("."));
    const type =
      kind === "original"
        ? photo.mimeType === "application/octet-stream"
          ? "application/octet-stream"
          : photo.mimeType
        : MIME[extension] ?? "application/octet-stream";

    const downloadName =
      kind === "original"
        ? photo.originalName
        : `${photo.originalName.replace(/\.[^.]+$/, "") || "photo"}.webp`;
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": type,
        "Cache-Control": isOwner ? "private, max-age=3600" : "private, max-age=300",
        ...(kind === "original" || wantsDownload
          ? {
              "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
            }
          : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}