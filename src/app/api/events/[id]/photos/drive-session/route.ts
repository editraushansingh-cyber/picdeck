import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  driveConnected,
  eventDriveFolder,
  initiateResumableUpload,
} from "@/lib/drive";
import { MAX_FILE_BYTES, isImageFile } from "@/lib/storage";

export const maxDuration = 60;

/**
 * Starts a Google Drive resumable upload for one photo.
 *
 * The browser PUTs the bytes straight to the URL Google returns, so a 25 MB
 * original never has to pass through a Vercel function (4.5 MB request limit).
 * The session URL is scoped to a single file and expires on its own.
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
      {
        error: "Connect Google Drive to upload photos",
        code: "DRIVE_REQUIRED",
      },
      { status: 409 },
    );
  }

  let payload: { name?: unknown; size?: unknown; type?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = String(payload.name ?? "photo").slice(0, 200);
  const size = Number(payload.size ?? 0);
  const type = String(payload.type ?? "");

  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: `${name}: empty file` }, { status: 400 });
  }
  if (size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `${name}: larger than 25 MB` }, { status: 400 });
  }
  if (!isImageFile(type, name)) {
    return NextResponse.json({ error: `${name}: unsupported file type` }, { status: 400 });
  }

  try {
    const folderId = await eventDriveFolder(user.id, event);
    const { uploadUrl } = await initiateResumableUpload(
      user.id,
      folderId,
      name,
      type || "application/octet-stream",
      size,
    );
    return NextResponse.json({ uploadUrl, folderId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Drive error" },
      { status: 502 },
    );
  }
}
