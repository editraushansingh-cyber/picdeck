"use server";

import { prisma } from "@/lib/db";
import { isGalleryUnlocked } from "@/lib/gallery-session";
import { publish } from "@/lib/gallery-events";

/**
 * Live pick: the client's tap is saved right away (no "Send" needed) so the
 * studio sees it the way CamTom's studio panel does. The final "Send my list"
 * still runs `saveSelection` with the client's name and phone.
 */
export async function pushLiveSelection(eventId: string, photoIds: string[]) {
  if (!(await isGalleryUnlocked(eventId))) {
    return { ok: false as const, message: "Gallery locked" };
  }
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { photos: { select: { id: true, status: true } } },
  });
  if (!event || event.status !== "ACTIVE") {
    return { ok: false as const, message: "Gallery not found" };
  }

  const validIds = new Set(
    event.photos.filter((photo) => photo.status === "READY").map((photo) => photo.id),
  );
  const chosen = Array.from(new Set(photoIds.filter((id) => validIds.has(id))));
  if (event.selectionLimit && chosen.length > event.selectionLimit) {
    return { ok: false as const, message: `Pick at most ${event.selectionLimit} photos` };
  }

  const before = await prisma.selection.findMany({
    where: { eventId },
    select: { photoId: true },
  });
  const beforeIds = new Set(before.map((row) => row.photoId));
  const same = beforeIds.size === chosen.length && chosen.every((id) => beforeIds.has(id));
  if (same) return { ok: true as const, count: chosen.length, changed: false };

  const logged = await prisma.$transaction(async (tx) => {
    await tx.selection.deleteMany({ where: { eventId } });
    if (chosen.length > 0) {
      await tx.selection.createMany({ data: chosen.map((photoId) => ({ eventId, photoId })) });
    }
    return tx.selectionEvent.create({
      data: { eventId, kind: "replace", photoIds: JSON.stringify(chosen), actor: "client" },
      select: { id: true, createdAt: true },
    });
  });

  publish({
    id: logged.id,
    eventId,
    kind: "replace",
    photoIds: chosen,
    actor: "client",
    at: logged.createdAt.toISOString(),
  });

  return { ok: true as const, count: chosen.length, changed: true };
}