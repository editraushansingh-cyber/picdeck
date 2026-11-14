export type DriveSettingsData = {
  oauthAvailable: boolean;
  status: "CONNECTED" | "REVOKED" | "ERROR" | "NONE";
  email: string | null;
  connectedAt: string | null;
  lastError: string | null;
  /** Where originals are being written right now: studio Drive or server disk. */
  originalStore: "DRIVE" | "LOCAL";
  /** Result of the OAuth round-trip, from ?drive=… */
  notice: string | null;
};

const NOTICES: Record<string, { tone: "ok" | "warn" | "error"; text: string }> = {
  connected: { tone: "ok", text: "Google Drive connected. New originals go to your Drive." },
  disconnected: {
    tone: "warn",
    text: "Drive disconnected. New originals are stored on the server again.",
  },
  denied: { tone: "warn", text: "You cancelled the Google consent screen — nothing changed." },
  not_configured: {
    tone: "error",
    text: "Google OAuth client is not set up on this deployment, so Drive cannot be connected.",
  },
  state_mismatch: {
    tone: "error",
    text: "The Drive handshake expired or came from another session. Please try connecting again.",
  },
  missing_code: { tone: "error", text: "Google did not return an authorisation code. Try again." },
  failed: { tone: "error", text: "Google rejected the connection. Try again in a minute." },
};

export function noticeFor(code: string | null) {
  return code ? NOTICES[code] ?? null : null;
}

export function DriveSettings({ data }: { data: DriveSettingsData }) {
  const { status, email, connectedAt, lastError, originalStore } = data;
  const connected = status === "CONNECTED";
  const notice = noticeFor(data.notice);

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Original photo storage</h2>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Connect your own Google Drive and every original you upload is saved in{" "}
            <span className="font-medium text-ink">PicDeck / &lt;event name&gt;</span> inside your
            Drive. Thumbnails and watermarked previews stay on the PicDeck server, so client
            galleries open fast and never wait on Drive.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
            connected
              ? "bg-emerald-50 text-emerald-700"
              : status === "NONE"
                ? "bg-surface text-muted"
                : "bg-amber-50 text-amber-800"
          }`}
        >
          {connected ? "Connected" : status === "NONE" ? "Not connected" : "Needs attention"}
        </span>
      </div>

      {notice && (
        <p
          className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : notice.tone === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notice.text}
        </p>
      )}

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Original where</dt>
          <dd className="text-right font-medium">
            {originalStore === "DRIVE" ? "Your Google Drive" : "PicDeck server disk"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Google account</dt>
          <dd className="text-right">{email ?? (connected ? "Connected" : "—")}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Thumbnails &amp; previews</dt>
          <dd className="text-right">PicDeck server (never Drive)</dd>
        </div>
        {connectedAt && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Connected on</dt>
            <dd className="text-right">{connectedAt}</dd>
          </div>
        )}
        {lastError && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Last error</dt>
            <dd className="max-w-[60%] break-words text-right text-red-700">{lastError}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {connected ? (
          <form action="/api/drive/disconnect" method="post">
            <button
              type="submit"
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface"
            >
              Disconnect Drive
            </button>
          </form>
        ) : (
          <a
            href="/api/drive/connect"
            aria-disabled={!data.oauthAvailable}
            className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${
              data.oauthAvailable
                ? "bg-brand hover:bg-brand/90"
                : "pointer-events-none bg-muted opacity-50"
            }`}
          >
            Connect Google Drive
          </a>
        )}
        {connected && (
          <a
            href="https://drive.google.com/drive/search?q=PicDeck"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface"
          >
            Open Drive
          </a>
        )}
      </div>

      <ul className="mt-4 space-y-1 text-xs text-muted">
        <li>
          • Access is limited to the <code className="rounded bg-surface px-1">drive.file</code>{" "}
          scope: PicDeck can only see and delete files it created — never the rest of your Drive.
        </li>
        <li>
          • Refresh tokens are stored encrypted (AES-256-GCM) in the database. Disconnecting
          revokes them; photos already uploaded stay in your Drive.
        </li>
        <li>
          • If Drive fails during an upload the photo is kept on the server instead, so a gallery is
          never left with a missing file.
        </li>
        {!data.oauthAvailable && (
          <li className="text-amber-800">
            • This deployment has no{" "}
            <code className="rounded bg-surface px-1">GOOGLE_OAUTH_CLIENT_ID</code> /{" "}
            <code className="rounded bg-surface px-1">GOOGLE_OAUTH_CLIENT_SECRET</code> yet.
          </li>
        )}
      </ul>
    </section>
  );
}