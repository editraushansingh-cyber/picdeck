import crypto from "crypto";
import { NextResponse } from "next/server";

/**
 * Remembers which studio started the Drive consent flow, and when. Signed so a
 * crafted `state` cannot hijack another studio's connection.
 */
const COOKIE = "pd_drive_state";
const TTL_SECONDS = 15 * 60;

function secret() {
  return process.env.AUTH_SECRET || "picdeck-dev-secret-change-me";
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(`drive:${value}`).digest("base64url");
}

export function createDriveState(userId: string) {
  const payload = `${userId}.${Date.now()}.${crypto.randomUUID()}`;
  const b64 = Buffer.from(payload).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

/** Returns the studio id the state belongs to, or null when invalid/expired. */
export function readDriveState(raw: string | undefined): string | null {
  if (!raw) return null;
  const [b64, signature] = raw.split(".");
  if (!b64 || !signature) return null;
  const expected = sign(b64);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const [userId, issuedAt] = Buffer.from(b64, "base64url").toString().split(".");
  if (!userId || !issuedAt) return null;
  if (Date.now() - Number(issuedAt) > TTL_SECONDS * 1000) return null;
  return userId;
}

/**
 * Verifies the signed `state` value returned by Google belongs to the studio
 * that is currently signed in. The callback must use this URL parameter—not
 * only the browser cookie—because an OAuth redirect can return on a different
 * host or after a browser has discarded its short-lived state cookie.
 */
export function callbackStateUser(
  state: string | null | undefined,
  currentUserId: string | null | undefined,
): string | null {
  const stateUserId = readDriveState(state ?? undefined);
  return currentUserId && stateUserId === currentUserId ? stateUserId : null;
}

export const DRIVE_STATE_COOKIE = COOKIE;
export const DRIVE_STATE_TTL = TTL_SECONDS;

export function stateCookie(value: string) {
  return {
    name: COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  };
}

export function settingsRedirect(base: string, params: Record<string, string>) {
  const url = new URL("/dashboard/settings", base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export function requestBase(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
}
