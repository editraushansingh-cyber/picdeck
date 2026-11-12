import { prisma } from "./db";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_PER_EVENT = 20;

/**
 * Gallery codes are 6 digits, so guessing must be bounded. We count failed
 * attempts server-side per (event, ip) inside 15 minutes, and per event in
 * that same window. Successful attempts do not count against the limit.
 */
export async function galleryLocked(eventId: string, ip: string) {
  const since = new Date(Date.now() - WINDOW_MS);
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

export async function recordAttempt(eventId: string, ip: string, success: boolean) {
  await prisma.galleryAttempt.create({ data: { eventId, ip, success } });
}

export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") || "unknown";
}