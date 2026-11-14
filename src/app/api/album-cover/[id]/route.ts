import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { readStored } from "@/lib/storage";

/** Album cover art. Published albums are public; drafts are owner-only. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const album = await prisma.album.findUnique({
    where: { id },
    select: { userId: true, published: true, coverPath: true },
  });
  if (!album?.coverPath) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!album.published) {
    const userId = await getUserId();
    if (userId !== album.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const file = await readStored(album.coverPath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": album.published ? "public, max-age=3600" : "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
