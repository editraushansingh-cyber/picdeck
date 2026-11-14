import { NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { readStored } from "@/lib/storage";

const TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
};

/** Background music for a published flipbook, streamed with Range support. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const album = await prisma.album.findUnique({
    where: { id },
    select: { userId: true, published: true, musicPath: true },
  });
  if (!album?.musicPath) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!album.published) {
    const userId = await getUserId();
    if (userId !== album.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const file = await readStored(album.musicPath);
    const type = TYPES[path.extname(album.musicPath).toLowerCase()] ?? "application/octet-stream";
    const range = request.headers.get("range");

    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      if (match) {
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Math.min(Number(match[2]), file.length - 1) : file.length - 1;
        if (start <= end) {
          return new NextResponse(new Uint8Array(file.subarray(start, end + 1)), {
            status: 206,
            headers: {
              "Content-Type": type,
              "Content-Range": `bytes ${start}-${end}/${file.length}`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      }
    }

    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
