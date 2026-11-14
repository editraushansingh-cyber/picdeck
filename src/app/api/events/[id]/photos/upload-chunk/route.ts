import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pushUploadChunk } from "@/lib/drive";

export const maxDuration = 60;

/**
 * Receives one slice of a photo from the browser and forward it server-side to
 * the Google Drive resumable session. This keeps every individual request under
 * Vercel's ~4.5 MB body limit while routing bytes somewhere the browser can
 * itself PUT to (Drive's upload endpoint blocks browser CORS).
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
    select: { id: true },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const driveUploadUrl = request.headers.get("x-drive-upload-url");
  const offsetRaw = request.headers.get("x-drive-offset");
  const totalRaw = request.headers.get("x-drive-total");
  if (!driveUploadUrl || !offsetRaw || !totalRaw) {
    return NextResponse.json({ error: "Missing upload headers" }, { status: 400 });
  }

  const offset = Number(offsetRaw);
  const total = Number(totalRaw);
  if (!Number.isFinite(offset) || !Number.isFinite(total)) {
    return NextResponse.json({ error: "Invalid offset/total" }, { status: 400 });
  }

  // The chunk bytes are the request body.
  let chunk: Uint8Array;
  try {
    chunk = new Uint8Array(await request.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Could not read chunk" }, { status: 400 });
  }
  if (chunk.byteLength === 0) {
    return NextResponse.json({ error: "Empty chunk" }, { status: 400 });
  }

  try {
    const result = await pushUploadChunk(driveUploadUrl, chunk, offset, total);
    return NextResponse.json({
      nextOffset: result.nextOffset,
      finished: result.finished,
      fileId: result.fileId ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Drive chunk error" },
      { status: 502 },
    );
  }
}