import { cookies } from "next/headers";
import { prisma } from "./db";

const COOKIE_PREFIX = "pd_gallery_";
const TTL_SECONDS = 60 * 60 * 12; // 12 hours

/** Grants this browser access to the given event's gallery for 12 hours. */
export async function unlockGallery(eventId: string) {
  const store = await cookies();
  store.set(`${COOKIE_PREFIX}${eventId}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function isGalleryUnlocked(eventId: string) {
  const store = await cookies();
  return store.get(`${COOKIE_PREFIX}${eventId}`)?.value === "1";
}

/** Returns the event when unlocked, otherwise null. */
export async function getUnlockedEvent(eventId: string) {
  if (!(await isGalleryUnlocked(eventId))) return null;
  return prisma.event.findUnique({
    where: { id: eventId },
    include: {
      // Only photos whose original has finished landing (Drive or fallback) are
      // visible to the client — CamTom's "photo appears after the Drive upload"
      // rule, enforced at the query instead of in the UI.
      photos: { where: { status: "READY" }, orderBy: { createdAt: "asc" } },
      selections: true,
    },
  });
}