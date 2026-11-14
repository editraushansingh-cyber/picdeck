import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { disconnectDrive } from "@/lib/drive";
import { requestBase, settingsRedirect } from "@/lib/drive-state";

/**
 * Disconnects the studio's Drive. Files already uploaded stay in their Drive;
 * only the app's access and stored tokens are removed (refresh token revoked).
 * POST /api/drive/disconnect
 */
export async function POST(request: Request) {
  const base = requestBase(request);
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.redirect(new URL("/login", base));

  const result = await disconnectDrive(user.id).catch(() => null);
  return settingsRedirect(base, { drive: result ? "disconnected" : "failed" });
}