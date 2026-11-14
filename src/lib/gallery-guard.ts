import { prisma } from "./db";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_PER_EVENT = 20;
const MAX_FAILS_PER_IP_GLOBAL = 10;

function windowStart() {
  return new Date(Date.now() - WINDOW_MS);
}

/**
 * A six-digit code is only safe if guessing is expensive. We count failed
 * attempts per device, per gallery, and globally per device (which covers codes
 * that do not match any gallery at all).
 */
export async function galleryLocked(eventId: string, ip: string) {
  const since = windowStart();
  const [perIp, perEvent] = await Promise.all([
    prisma.galleryAttempt.count({
      where: { eventId, ip, success: false, createdAt: { gte: since } },
    }),
    prisma.galleryAttempt.count({
      where: { eventId, success: false, createdAt: { gte: since } },
    }),
  ]);
  return perIp >= MAX_FAILS_PER_IP || perEvent >= MAX_FAILS_PER_EVENT;
}

/** Bounds guessing even when the submitted code matches no gallery. */
export async function ipLocked(ip: string) {
  const count = await prisma.galleryAttempt.count({
    where: { ip, success: false, createdAt: { gte: windowStart() } },
  });
  return count >= MAX_FAILS_PER_IP_GLOBAL;
}

export async function recordAttempt(eventId: string, ip: string, success: boolean) {
  await prisma.galleryAttempt.create({ data: { eventId, ip, success } });
}

export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") || "unknown";
}
