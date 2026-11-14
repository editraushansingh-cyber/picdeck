import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readStored } from "@/lib/storage";

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

  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const relative = photo.previewPath ?? photo.thumbPath;
  if (!relative) return NextResponse.json({ error: "No preview" }, { status: 404 });

  try {
    const file = await readStored(relative);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": relative.endsWith(".webp") ? "image/webp" : photo.mimeType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}