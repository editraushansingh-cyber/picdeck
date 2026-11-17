import { exchangeCode, oauthConfigured, saveDriveLink } from "@/lib/drive";
import {
  consumeDriveOAuth,
  DRIVE_STATE_COOKIE,
  requestBase,
  settingsRedirect,
} from "@/lib/drive-state";

/**
 * Google redirects here after consent.
 * GET /api/drive/callback?code=…&state=…
 */
export async function GET(request: Request) {
  const base = requestBase(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const finish = (params: Record<string, string>) => {
    const response = settingsRedirect(base, params);
    response.cookies.delete(DRIVE_STATE_COOKIE);
    return response;
  };

  if (error) return finish({ drive: "denied" });
  if (!code) return finish({ drive: "missing_code" });
  if (!oauthConfigured()) return finish({ drive: "not_configured" });

  const stateUserId = await consumeDriveOAuth(state);
  if (!stateUserId) {
    // State is opaque, stored server-side, expires quickly, and is single-use.
    return finish({ drive: "state_mismatch" });
  }

  try {
    const tokens = await exchangeCode(code);
    const email = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((json: { email?: string } | null) => json?.email ?? null)
      .catch(() => null);

    await saveDriveLink(stateUserId, tokens, email);
    return finish({ drive: "connected" });
  } catch {
    return finish({ drive: "failed" });
  }
}
