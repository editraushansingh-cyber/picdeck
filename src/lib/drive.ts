import { prisma } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";
import crypto from "crypto";

/**
 * Per-studio Google Drive, via OAuth.
 *
 * Each photographer connects their own Google account. We only request the
 * `drive.file` scope, so the app can create, read and delete the files it
 * created (and nothing else in the user's Drive).
 *
 * Setup (one time, by the operator):
 *   1. Google Cloud Console → create a project → enable "Google Drive API".
 *   2. OAuth consent screen → External → add test users (or publish).
 *   3. Credentials → OAuth client ID → Web application.
 *      Authorised redirect URI: <APP_URL>/api/drive/callback
 *   4. Set in .env:
 *        GOOGLE_OAUTH_CLIENT_ID="..."
 *        GOOGLE_OAUTH_CLIENT_SECRET="..."
 *        NEXT_PUBLIC_APP_URL="https://yourdomain.com"
 *
 * Tokens are stored AES-256-GCM encrypted (lib/crypto.ts).
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const ROOT_FOLDER_NAME = "PicDeck";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export function oauthConfigured() {
  return !!process.env.GOOGLE_OAUTH_CLIENT_ID && !!process.env.GOOGLE_OAUTH_CLIENT_SECRET;
}

export function redirectUri() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/drive/callback`;
}

/** Builds the consent URL. `state` is a signed, short-lived nonce (see actions/drive.ts). */
export function consentUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
      ...body,
    }),
  });
  return (await response.json()) as TokenResponse;
}

export async function exchangeCode(code: string) {
  const json = await tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
  });
  if (!json.access_token || !json.refresh_token) {
    throw new Error(json.error_description || json.error || "Google did not return tokens");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in ?? 3600,
    scope: json.scope ?? DRIVE_SCOPE,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

/** Persists (or replaces) a studio's Drive connection. */
export async function saveDriveLink(
  userId: string,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number; scope: string },
  email?: string | null,
) {
  const link = await prisma.driveLink.upsert({
    where: { userId },
    update: {
      refreshToken: encryptSecret(tokens.refreshToken),
      accessToken: encryptSecret(tokens.accessToken),
      accessExpiry: new Date(Date.now() + (tokens.expiresIn - 60) * 1000),
      scope: tokens.scope,
      status: "CONNECTED",
      lastError: null,
      email: email ?? undefined,
    },
    create: {
      userId,
      email: email ?? null,
      refreshToken: encryptSecret(tokens.refreshToken),
      accessToken: encryptSecret(tokens.accessToken),
      accessExpiry: new Date(Date.now() + (tokens.expiresIn - 60) * 1000),
      scope: tokens.scope,
    },
  });

  // Make sure the root folder exists, then remember its id.
  try {
    const rootId = await ensureFolderFor(userId, null, ROOT_FOLDER_NAME);
    await prisma.driveLink.update({ where: { id: link.id }, data: { folderId: rootId } });
  } catch (error) {
    await prisma.driveLink.update({
      where: { id: link.id },
      data: { status: "ERROR", lastError: message(error) },
    });
  }
  return link;
}

export async function disconnectDrive(userId: string) {
  const link = await prisma.driveLink.findUnique({ where: { userId } });
  if (!link) return { ok: true as const };
  const refresh = decryptSecret(link.refreshToken);
  if (refresh) {
    // Best-effort revoke; the local record is removed either way.
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, {
      method: "POST",
    }).catch(() => null);
  }
  await prisma.driveLink.delete({ where: { userId } });
  return { ok: true as const };
}

function message(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 200) : "Unknown Drive error";
}

/**
 * Returns a usable access token for the studio, refreshing when it is about to
 * expire. Throws when the studio has no (working) Drive connection.
 */
export async function driveToken(userId: string): Promise<string> {
  const link = await prisma.driveLink.findUnique({ where: { userId } });
  if (!link || link.status !== "CONNECTED") throw new Error("Drive is not connected");

  const cached = decryptSecret(link.accessToken ?? "");
  if (cached && link.accessExpiry && link.accessExpiry.getTime() > Date.now()) return cached;

  const refresh = decryptSecret(link.refreshToken);
  if (!refresh) throw new Error("Drive connection is not readable; reconnect Drive");

  const json = await refreshAccessToken(refresh);
  if (!json.access_token) {
    await prisma.driveLink.update({
      where: { id: link.id },
      data: { status: "REVOKED", lastError: json.error ?? "Refresh failed" },
    });
    throw new Error("Drive access was revoked; reconnect Drive");
  }
  if (json.refresh_token) {
    // Google occasionally rotates; keep the newest refresh token.
  }

  await prisma.driveLink.update({
    where: { id: link.id },
    data: {
      accessToken: encryptSecret(json.access_token),
      accessExpiry: new Date(Date.now() + ((json.expires_in ?? 3600) - 60) * 1000),
      ...(json.refresh_token ? { refreshToken: encryptSecret(json.refresh_token) } : {}),
    },
  });
  return json.access_token;
}

export async function driveConnected(userId: string) {
  const link = await prisma.driveLink.findUnique({
    where: { userId },
    select: { status: true, email: true, folderId: true, connectedAt: true, lastError: true },
  });
  return link;
}

async function driveFetch(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Drive ${response.status}: ${text.slice(0, 120)}`);
  }
  return response.json();
}

/** Creates (or reuses) a folder. `parentId` null means the PicDeck root. */
export async function ensureFolderFor(userId: string, parentId: string | null, name: string) {
  const token = await driveToken(userId);
  const safeName = name.replace(/'/g, "\\'").slice(0, 120);
  const scope = parentId ? `'${parentId}' in parents` : "'root' in parents";
  const query = encodeURIComponent(`name = '${safeName}' and mimeType = '${FOLDER_MIME}' and ${scope} and trashed = false`);
  const found = await driveFetch(token, `/files?q=${query}&fields=files(id,name)&pageSize=1`);
  const existing = (found as { files?: { id: string }[] }).files?.[0];
  if (existing) return existing.id;

  const created = await driveFetch(token, "/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : undefined }),
  });
  return (created as { id: string }).id;
}

/** Uploads one buffer into a folder. Returns the Drive file id. */
export async function uploadToDrive(
  userId: string,
  buffer: Buffer,
  name: string,
  parentId: string,
  mimeType = "application/octet-stream",
) {
  const token = await driveToken(userId);
  const boundary = `picdeck${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name, parents: [parentId] });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const response = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,size`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: new Uint8Array(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Drive upload ${response.status}: ${text.slice(0, 120)}`);
  }
  const json = (await response.json()) as { id: string };
  return json.id;
}

/** Streams a file back from the studio's Drive (used for original downloads). */
export async function downloadFromDrive(userId: string, fileId: string): Promise<Buffer> {
  const token = await driveToken(userId);
  const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Drive download ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function deleteFromDrive(userId: string, fileId: string) {
  const token = await driveToken(userId);
  await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
}

/**
 * Calls an upload for the studio: Drive when connected, otherwise the supplied
 * local fallback so an upload never fails because a studio skipped Drive.
 */
export async function uploadOriginal(
  userId: string,
  buffer: Buffer,
  name: string,
  parentId: string,
  mimeType: string,
  localFallback: () => Promise<void>,
): Promise<{ store: "DRIVE" | "LOCAL"; fileId: string | null; error?: string }> {
  const link = await driveConnected(userId);
  if (!link || link.status !== "CONNECTED") {
    await localFallback();
    return { store: "LOCAL", fileId: null };
  }
  try {
    const fileId = await uploadToDrive(userId, buffer, name, parentId, mimeType);
    return { store: "DRIVE", fileId };
  } catch (error) {
    // Never lose a client photo because Drive hiccupped: keep the local copy.
    await localFallback();
    return { store: "LOCAL", fileId: null, error: message(error) };
  }
}

export function driveConfiguredStatus(link: Awaited<ReturnType<typeof driveConnected>>) {
  if (!oauthConfigured()) return "Google OAuth client not configured";
  if (!link) return "Not connected";
  if (link.status === "CONNECTED") return link.email ? `Connected as ${link.email}` : "Connected";
  if (link.status === "REVOKED") return "Access revoked — reconnect";
  return link.lastError || "Connection error";
}
