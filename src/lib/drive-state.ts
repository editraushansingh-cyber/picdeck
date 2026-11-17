import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "./db";

/**
 * Remembers which studio started the Drive consent flow. The browser receives
 * an opaque random value; only its hash is stored, and every callback consumes
 * its record once. This survives OAuth callbacks returning on another host.
 */
const COOKIE = "pd_drive_state";
const TTL_SECONDS = 15 * 60;

export function createDriveState() {
  return crypto.randomBytes(32).toString("base64url");
}

export function driveStateHash(state: string) {
  return crypto.createHash("sha256").update(state).digest("hex");
}

export async function beginDriveOAuth(userId: string) {
  const now = new Date();
  const state = createDriveState();
  await prisma.$transaction([
    prisma.driveOAuthAttempt.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.driveOAuthAttempt.create({
      data: {
        userId,
        stateHash: driveStateHash(state),
        expiresAt: new Date(now.getTime() + TTL_SECONDS * 1000),
      },
    }),
  ]);
  return state;
}

/** Returns the studio for a valid, one-time callback state and consumes it. */
export async function consumeDriveOAuth(state: string | null): Promise<string | null> {
  if (!state) return null;
  const attempt = await prisma.driveOAuthAttempt.findUnique({
    where: { stateHash: driveStateHash(state) },
  });
  if (!attempt) return null;
  if (attempt.expiresAt.getTime() <= Date.now()) {
    await prisma.driveOAuthAttempt.delete({ where: { id: attempt.id } }).catch(() => null);
    return null;
  }
  try {
    await prisma.driveOAuthAttempt.delete({ where: { id: attempt.id } });
    return attempt.userId;
  } catch {
    return null;
  }
}

export const DRIVE_STATE_COOKIE = COOKIE;
export const DRIVE_STATE_TTL = TTL_SECONDS;

export function settingsRedirect(base: string, params: Record<string, string>) {
  const url = new URL("/dashboard/settings", base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export function requestBase(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
}
