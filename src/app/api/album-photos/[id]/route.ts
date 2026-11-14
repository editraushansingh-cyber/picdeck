import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readStored } from "@/lib/storage";
import { downloadFromDrive } from "@/lib/drive";

/**
 * Album photos are public-by-slug: the album link itself is the secret, so this
 * route only serves thumbnails/previews of photos that appear in a page of a
 * published album. Originals are never served here.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/album-photos/[id]">,
) {
  const { id } = await context.params;

  const page = await prisma.albumPage.findFirst({
    where: {
      OR: [{ photoAId: id }, { photoBId: id }],
      album: { published: true },
    },
    select: { id: true },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const photo = await prisma.photo.findUnique({
    where: { id },
    include: { event: { select: { userId: true } } },
  });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Drive-only photos keep their derivatives in the studio's Drive; the object
  // store is the fallback for photos uploaded before Drive was connected.
  const driveId = photo.previewDriveFileId ?? photo.thumbDriveFileId;
  const relative = photo.previewPath ?? photo.thumbPath;
  if (!driveId && !relative) {
    return NextResponse.json({ error: "No preview" }, { status: 404 });
  }

  try {
    const file = driveId
      ? await downloadFromDrive(photo.event.userId, driveId)
      : await readStored(relative as string);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}