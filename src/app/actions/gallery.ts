"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { unlockGallery } from "@/lib/gallery-session";
import { clientIp, galleryLocked, ipLocked, recordAttempt } from "@/lib/gallery-guard";
import { publish } from "@/lib/gallery-events";

export async function submitGalleryCode(formData: FormData) {
  const code = String(formData.get("code") || "").replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) return { ok: false as const, message: "Enter the 6-digit code" };

  const ip = clientIp(await headers());
  const lockedMessage =
    "Too many attempts from this device. Try again in 15 minutes.";

  if (await ipLocked(ip)) return { ok: false as const, message: lockedMessage };

  const event = await prisma.event.findUnique({ where: { galleryCode: code } });
  if (!event || event.status !== "ACTIVE") {
    await recordAttempt("unknown", ip, false);
    return { ok: false as const, message: "That code does not match any gallery" };
  }
  if (await galleryLocked(event.id, ip)) {
    return { ok: false as const, message: lockedMessage };
  }
  await recordAttempt(event.id, ip, true);
  await unlockGallery(event.id);
  redirect(`/g/${event.galleryCode}`);
}

export async function saveSelection(
  eventId: string,
  photoIds: string[],
  client: { name?: string; phone?: string },
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { photos: { select: { id: true, status: true } } },
  });
  if (!event) return { ok: false as const, message: "Gallery not found" };
  if (event.status !== "ACTIVE") return { ok: false as const, message: "This gallery is closed" };

  // A photo is only visible once its original has landed (Drive or fallback).
  const validIds = new Set(
    event.photos.filter((photo) => photo.status === "READY").map((photo) => photo.id),
  );
  const chosen = Array.from(new Set(photoIds.filter((id) => validIds.has(id))));

  if (event.selectionLimit && chosen.length > event.selectionLimit) {
    return {
      ok: false as const,
      message: `You can select at most ${event.selectionLimit} photos`,
    };
  }

  const before = await prisma.selection.findMany({
    where: { eventId },
    select: { photoId: true },
  });
  const beforeIds = new Set(before.map((row) => row.photoId));
  const afterIds = new Set(chosen);
  const added = chosen.filter((id) => !beforeIds.has(id));
  const removed = Array.from(beforeIds).filter((id) => !afterIds.has(id));
  const changed = added.length > 0 || removed.length > 0;
  const kind = !changed
    ? null
    : removed.length > 0 && added.length === 0
      ? ("unselect" as const)
      : added.length > 0 && removed.length === 0
        ? ("select" as const)
        : ("replace" as const);
  const clientName = client.name?.trim() || null;

  const logged: { id: string; createdAt: Date } | null = await prisma.$transaction(async (tx) => {
    await tx.selection.deleteMany({ where: { eventId } });
    if (chosen.length > 0) {
      await tx.selection.createMany({
        data: chosen.map((photoId) => ({
          eventId,
          photoId,
          clientName,
          clientPhone: client.phone?.trim() || null,
        })),
      });
    }
    if (!kind) return null;
    // The log lets reconnecting tabs replay whatever they missed while asleep.
    return tx.selectionEvent.create({
      data: { eventId, kind, photoIds: JSON.stringify(chosen), actor: "client", clientName },
      select: { id: true, createdAt: true },
    });
  });

  if (kind && logged) {
    publish({
      id: logged.id,
      eventId,
      kind,
      photoIds: chosen,
      actor: "client",
      clientName,
      at: logged.createdAt.toISOString(),
    });
  }

  return { ok: true as const, count: chosen.length };
}