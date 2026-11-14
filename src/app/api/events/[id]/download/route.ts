import { NextResponse } from "next/server";
import { ZipArchive } from "archiver";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { isGalleryUnlocked } from "@/lib/gallery-session";
import { readStored } from "@/lib/storage";
import { downloadFromDrive } from "@/lib/drive";

/**
 * One-click folder download.
 *
 * Owner: always allowed, originals included.
 * Client: allowed when the event has downloads enabled; originals only when the
 * studio has also enabled original-size downloads (otherwise previews).
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/events/[id]/download">,
) {
  const { id } = await context.params;

  const event = await prisma.event.findFirst({
    where: { id },
    include: {
      photos: { orderBy: { createdAt: "asc" } },
      selections: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = await getUserId();
  const isOwner = userId === event.userId;
  const isClient = !isOwner && (await isGalleryUnlocked(event.id));

  if (!isOwner && !isClient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isClient && (event.status !== "ACTIVE" || !event.downloadEnabled)) {
    return NextResponse.json({ error: "Downloads are disabled" }, { status: 403 });
  }

  const selectedIds = new Set(event.selections.map((selection) => selection.photoId));
  // Clients get exactly what they picked; the studio can pull the whole folder.
  const photos = isOwner ? event.photos : event.photos.filter((photo) => selectedIds.has(photo.id));
  if (photos.length === 0) {
    return NextResponse.json({ error: "Nothing to download yet" }, { status: 404 });
  }

  const useOriginals = isOwner || event.originalDownloadEnabled;
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
  });

  const used = new Set<string>();
  let added = 0;
  for (const photo of photos) {
    let data: Buffer | null = null;
    const previewDriveId = photo.previewDriveFileId ?? photo.thumbDriveFileId;
    if (useOriginals && photo.originalStore === "DRIVE" && photo.driveFileId) {
      data = await downloadFromDrive(event.userId, photo.driveFileId).catch(() => null);
    } else if (!useOriginals && previewDriveId) {
      // Drive-only photos keep previews in the studio's Drive.
      data = await downloadFromDrive(event.userId, previewDriveId).catch(() => null);
    } else {
      const relative = useOriginals
        ? photo.localOriginalPath
        : (photo.previewPath ?? photo.thumbPath);
      if (relative) data = await readStored(relative).catch(() => null);
    }
    if (!data) continue;

    // Keep original names but guarantee uniqueness inside the archive.
    let name = useOriginals
      ? photo.originalName
      : `${photo.originalName.replace(/\.[^.]+$/, "") || "photo"}.webp`;
    if (used.has(name)) {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      name = `${base}-${added + 1}${ext}`;
    }
    used.add(name);
    archive.append(data, { name });
    added += 1;
  }

  if (added === 0) return NextResponse.json({ error: "Files missing" }, { status: 404 });

  const folder = event.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "photos";
  await archive.finalize();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${folder}-picdeck.zip"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}