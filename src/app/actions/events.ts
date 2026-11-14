"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, generateGalleryCode } from "@/lib/auth";
import { activeSubscription } from "@/lib/plans";
import { EVENT_LIMIT, TIER_LABELS, tierOf } from "@/lib/modules";
import { deleteEventFiles, deletePhotoFiles } from "@/lib/storage";
import { deleteFromDrive } from "@/lib/drive";

async function uniqueGalleryCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateGalleryCode();
    if (!(await prisma.event.findUnique({ where: { galleryCode: code } }))) return code;
  }
  throw new Error("Could not allocate a gallery code");
}

export async function createEvent(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") || "").trim();
  if (title.length < 2) return { ok: false as const, message: "Give the event a name" };

  const sub = await activeSubscription(user.id);
  const tier = tierOf(sub?.plan.slug ?? null);
  const limit = EVENT_LIMIT[tier];
  if (limit !== null) {
    const active = await prisma.event.count({
      where: { userId: user.id, status: "ACTIVE" },
    });
    if (active >= limit) {
      return {
        ok: false as const,
        message: `The ${TIER_LABELS[tier]} plan keeps ${limit} active event. Archive it or move to a paid plan for unlimited events.`,
      };
    }
  }

  const eventDateRaw = String(formData.get("eventDate") || "");
  const eventDate = eventDateRaw ? new Date(eventDateRaw) : null;
  if (eventDate && Number.isNaN(eventDate.getTime())) {
    return { ok: false as const, message: "Event date is invalid" };
  }

  const limitRaw = String(formData.get("selectionLimit") || "").trim();
  const selectionLimit = limitRaw ? Math.max(1, Math.min(5000, Number(limitRaw))) : null;

  const event = await prisma.event.create({
    data: {
      userId: user.id,
      title,
      eventDate,
      clientName: String(formData.get("clientName") || "").trim() || null,
      clientPhone: String(formData.get("clientPhone") || "").trim() || null,
      clientEmail: String(formData.get("clientEmail") || "").trim() || null,
      note: String(formData.get("note") || "").trim() || null,
      selectionLimit,
      downloadEnabled: formData.get("downloadEnabled") === "on",
      originalDownloadEnabled: formData.get("originalDownloadEnabled") === "on",
      galleryCode: await uniqueGalleryCode(),
    },
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${event.id}`);
}

export async function updateEventSettings(eventId: string, formData: FormData) {
  const user = await requireUser();
  const event = await prisma.event.findFirst({ where: { id: eventId, userId: user.id } });
  if (!event) return { ok: false as const, message: "Event not found" };

  const limitRaw = String(formData.get("selectionLimit") || "").trim();
  await prisma.event.update({
    where: { id: eventId },
    data: {
      selectionLimit: limitRaw ? Math.max(1, Math.min(5000, Number(limitRaw))) : null,
      downloadEnabled: formData.get("downloadEnabled") === "on",
      originalDownloadEnabled: formData.get("originalDownloadEnabled") === "on",
      clientEmail: String(formData.get("clientEmail") || "").trim() || null,
    },
  });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true as const, message: "Settings saved" };
}

export async function regenerateGalleryCode(eventId: string) {
  const user = await requireUser();
  const event = await prisma.event.findFirst({ where: { id: eventId, userId: user.id } });
  if (!event) return { ok: false as const, message: "Event not found" };
  const galleryCode = await uniqueGalleryCode();
  await prisma.event.update({ where: { id: eventId }, data: { galleryCode } });
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true as const, message: "New code generated. The old code no longer works." };
}

export async function archiveEvent(eventId: string) {
  const user = await requireUser();
  const event = await prisma.event.findFirst({ where: { id: eventId, userId: user.id } });
  if (!event) return { ok: false as const, message: "Event not found" };
  await prisma.event.update({
    where: { id: eventId },
    data: { status: event.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" },
  });
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function deleteEvent(eventId: string) {
  const user = await requireUser();
  const event = await prisma.event.findFirst({ where: { id: eventId, userId: user.id } });
  if (!event) return { ok: false as const, message: "Event not found" };
  // Remove originals from the studio's Drive too, so a deleted event does not
  // leave client photos behind in a personal Drive.
  const drivePhotos = await prisma.photo.findMany({
    where: { eventId, originalStore: "DRIVE", driveFileId: { not: null } },
    select: { driveFileId: true, thumbDriveFileId: true, previewDriveFileId: true },
  });
  for (const photo of drivePhotos) {
    for (const fileId of [photo.driveFileId, photo.thumbDriveFileId, photo.previewDriveFileId]) {
      if (fileId) await deleteFromDrive(user.id, fileId);
    }
  }
  await prisma.event.delete({ where: { id: eventId } });
  await deleteEventFiles(eventId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function deletePhoto(photoId: string) {
  const user = await requireUser();
  const photo = await prisma.photo.findFirst({
    where: { id: photoId, event: { userId: user.id } },
  });
  if (!photo) return { ok: false as const, message: "Photo not found" };
  await prisma.photo.delete({ where: { id: photoId } });
  await deletePhotoFiles(photo.eventId, photo.filename, photo.localOriginalPath);
  // Drive-only mode: remove the original and its derivatives from the studio's Drive.
  if (photo.originalStore === "DRIVE") {
    for (const fileId of [photo.driveFileId, photo.thumbDriveFileId, photo.previewDriveFileId]) {
      if (fileId) await deleteFromDrive(user.id, fileId);
    }
  }
  revalidatePath(`/dashboard/events/${photo.eventId}`);
  return { ok: true as const };
}

/** Lists the selected photos with download URLs, for the dashboard download button. */
export async function selectedPhotosForDownload(eventId: string) {
  const user = await requireUser();
  const event = await prisma.event.findFirst({
    where: { id: eventId, userId: user.id },
    include: { selections: { include: { photo: true } } },
  });
  if (!event) return [];
  return event.selections.map((selection) => ({
    id: selection.photo.id,
    name: selection.photo.originalName,
    url: `/api/photos/${selection.photo.id}/file?kind=${
      event.originalDownloadEnabled ? "original" : "preview"
    }`,
    storagePath:
      selection.photo.originalStore === "DRIVE"
        ? `drive:${selection.photo.driveFileId ?? ""}`
        : selection.photo.localOriginalPath,
  }));
}

export async function canCreateEvent() {
  const user = await requireUser();
  const sub = await activeSubscription(user.id);
  const tier = tierOf(sub?.plan.slug ?? null);
  const limit = EVENT_LIMIT[tier];
  if (limit === null) return { allowed: true, subscription: sub, limit, active: 0 };
  const active = await prisma.event.count({ where: { userId: user.id, status: "ACTIVE" } });
  return { allowed: active < limit, subscription: sub, limit, active };
}