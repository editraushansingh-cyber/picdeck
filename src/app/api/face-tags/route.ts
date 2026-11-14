import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUnlockedEvent } from "@/lib/gallery-session";
import { accessFor } from "@/lib/access";

/**
 * Name-based photo lookup for an unlocked client gallery. The studio names a
 * cluster ("Meera", "Rohan's family"), and clients tap that name to see those
 * photos. Returns ids only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "").replace(/\D/g, "").slice(0, 6);
  const tag = (url.searchParams.get("tag") || "").trim().slice(0, 40);

  if (code.length !== 6) return NextResponse.json({ error: "Invalid gallery" }, { status: 400 });
  if (!tag) return NextResponse.json({ error: "Pick a name" }, { status: 400 });

  const event = await prisma.event.findUnique({ where: { galleryCode: code } });
  if (!event || event.status !== "ACTIVE") {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  const gallery = await getUnlockedEvent(event.id);
  if (!gallery) return NextResponse.json({ error: "Unlock the gallery first" }, { status: 403 });

  const access = await accessFor(event.userId);
  if (!access.can("faces")) {
    return NextResponse.json({ error: "Face search is not enabled" }, { status: 403 });
  }

  const rows = await prisma.faceDescriptor.findMany({
    where: { tag, photo: { eventId: event.id } },
    select: { photoId: true },
    take: 200,
  });

  return NextResponse.json({ tag, photoIds: rows.map((row) => row.photoId) });
}
