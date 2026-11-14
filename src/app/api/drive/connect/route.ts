import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { consentUrl, oauthConfigured } from "@/lib/drive";
import {
  createDriveState,
  requestBase,
  settingsRedirect,
  stateCookie,
} from "@/lib/drive-state";

/**
 * Starts the per-studio Google Drive consent flow.
 * GET /api/drive/connect → 302 to Google (drive.file scope, offline access).
 */
export async function GET(request: Request) {
  const base = requestBase(request);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", base));

  if (!oauthConfigured()) {
    return settingsRedirect(base, { drive: "not_configured" });
  }

  const state = createDriveState(user.id);
  const response = NextResponse.redirect(consentUrl(state));
  response.cookies.set(stateCookie(state));
  return response;
}