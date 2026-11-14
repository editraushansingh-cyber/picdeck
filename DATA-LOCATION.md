# PicDeck Production Setup — Data Location & Checklist

## Summary

PicDeck now lets each photographer connect their **own Google Drive** (`drive.file` scope). Originals go to that Drive, thumbnails+watermarked previews stay on the app server (or optional S3/R2). Galleries never wait on Drive; no lost files.

### Tech Stack
- **Frontend**: Next.js 16 (partial prerender, app router)
- **DB**: SQLite (dev) / **Postgres** (production) — use Neon free tier
- **Drive OAuth**: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
- **Mail**: Resend (optional; mailto: fallback)
- **Storage**: `GOOGLE_OAUTH_CLIENT_*` + per‑studio Drive folder; `storage/events/…` (default)

### Data Split

| Data                      | Home                      | Notes |
|---------------------------|---------------------------|-------|
| **Events, photos, albums, invoice rows, notifications, studio sites, invites** | **Postgres** (Neon free tier) | The `/dashboard` UI reads/writes here. |
| **User plans (free, paid), subscriptions, referral credits** | **Postgres** | Gated in UI (`MODULES_BY_TIER`). |
| **Original uploaded photos** | **Photographer's Google Drive** (`PicDeck/<event title>/…`) | Per‑studio OAuth, `drive.file` scope only → app sees only files it created. |
| **Thumbnails & watermarked previews** | **App server disk** (`storage/events/<id>/{thumb,preview}`) | Always local; client galleries never reference Drive. |
| **Studio branding (logo, watermark, backgrounds), site covers, album covers/WAV music** | **App server disk** (`storage/studios/`, `storage/albums/`) | |
| **Drive OAuth tokens** | **Postgres** (`DriveLink.refreshToken`, encrypted AES‑256‑GCM) | Key derived from `AUTH_SECRET`. |
| **Session cookies** | **Client HTTP‑only** (`picdeck_session`) | Signed with `AUTH_SECRET`. |
| **Gallery session cookies** | **Client** (`pd_gallery_<eventId>`) | 12‑hour live session (no login). |
| **Notifications queue** | **Postgres** (`Notification`), email via **mailto:** (or Resend) | **SMS/WhatsApp removed** from this build. |
| **Filesystem (uploads) fallback** | **Local disk** (`storage/events/<id>/orig/`) | When Drive fails/disconnected, originals saved here; `Photo.originalStore = LOCAL`. |

### Production Checklist

#### 1. PostgreSQL (Neon & Prisma)
- [ ] Create **Neon project** (`neon.tech`) → connection string `DATABASE_URL=postgresql://…`
- [ ] Copy `.env.example` → `.env`, set:
  ```env
  DATABASE_URL=postgresql://…
  AUTH_SECRET=long‑secure‑random‑string‑change‑this  # used for cookies & Drive token encryption
  ```
- [ ] Generate the **Postgres** schema once (the shipped migration folders are SQLite):
  ```bash
  mkdir -p prisma/migrations/0_init
  DATABASE_URL="postgresql://…" npx prisma migrate diff --from-empty \
    --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql
  npx prisma migrate resolve --applied 0_init   # only if you already deployed it by hand
  npx prisma migrate deploy
  npx prisma generate
  ```
  Keep the old SQLite folders out of the deploy image, or reset `prisma/migrations/` to just the
  Postgres one before the first production deploy.

#### 2. Google OAuth Client
- [ ] **Google Cloud Console** → new project → enable “Google Drive API”
- [ ] **OAuth consent screen** → External → add test users (or publish)
- [ ] **Credentials** → OAuth client ID → Web application
  - **Authorised redirect URI**: `https://yourdomain.com/api/drive/callback`
  - Copy `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
- [ ] Set in `.env`:
  ```env
  GOOGLE_OAUTH_CLIENT_ID=…
  GOOGLE_OAUTH_CLIENT_SECRET=…
  NEXT_PUBLIC_APP_URL=https://yourdomain.com   # used for redirect URIs
  ```

#### 3. Storage (optional, for previews)
- [ ] **Default** (`storage/` local disk) works fine
- [ ] **S3/R2** → implement an `OriginalSink`/object-store adapter next to `localOriginalSink`
  in `src/lib/storage.ts` (the interface is the seam; nothing ships for S3 yet)
- [ ] No action needed for Drive OAuth (per‑studio)

#### 4. Email (optional)
- [ ] **Resend** → API key (`RESEND_API_KEY`) → set in `.env`
- Notifications use `mailto:` as fallback; UI says “mail app”.

#### 5. Delete SMS/WhatsApp vestiges (done)
- [x] OTP verification removed: `OtpCode` table dropped
- [x] `/register` → single‑step form (no phone verification)
- [x] Notification channels only “email”
- [x] WhatsApp surfaces only on `StudioSite.whatsapp` (contact card)
- [x] `OTP_MODE` → `DEMO_MODE=on` (dev only)

#### 6. Watermark & branding (`storage/studios/`)
- [ ] Ensure `storage/` writable (`STORAGE_ROOT` env)
- [ ] Logo uploads via `/dashboard/settings`

#### 7. App‑URL & cookies
- [ ] Set `NEXT_PUBLIC_APP_URL` (public DNS)
- [ ] `NODE_ENV=production`: cookies `secure: true`

#### 8. Free‑plan sign‑up
- [x] Registration automatically starts on `free` plan (1 active event)
- [x] Admin can assign paid plans (stripe integration pending)

### Files & Routes Created

| Path                     | Purpose |
|--------------------------|---------|
| `src/lib/drive.ts` | Per‑studio OAuth client (token refresh, upload, folder ensure) |
| `src/lib/crypto.ts` | AES‑256‑GCM encryption for stored tokens |
| `src/lib/drive‑state.ts` | Signed `state` cookie for OAuth flow |
| `src/app/api/drive/connect/route.ts` | Redirect to Google consent |
| `src/app/api/drive/callback/route.ts` | Exchange `code` → tokens, store `DriveLink` |
| `src/app/api/drive/disconnect/route.ts` | Revoke token & delete link |
| `src/components/DriveSettings.tsx` | UI for “Connect Google Drive” |
| `prisma/schema.prisma` | `DriveLink`, `StorageConnection`, `Photo.originalStore`, `Photo.localOriginalPath`, `Event.driveFolderId` |
| `prisma/migrations/20261113180000_drive_oauth/` | Adds Drive models, drops `OtpCode`, updates `Notification.channel` |

### Deployment Steps

1. **Build**: `npm run build`
2. **Env**: `.env` with PostgreSQL URL, OAuth keys, `NEXT_PUBLIC_APP_URL`
3. **Run**: `npm start` (`NODE_ENV=production`)
4. **Test**:
   - `/register` → free plan
   - `/dashboard/events` → create event
   - `/dashboard/settings` → Connect Google Drive (button disabled if ID/secret missing)
   - Upload photo → Drive falls back → preview & thumb load
   - `/dashboard/notifications` → email-only queue
   - `/demo` (only if `DEMO_MODE=on` locally)

### That’s It

Now photographers own their data:
- **Postgres** (Neon) holds metadata, tokens encrypted
- **Google Drive** (their own) holds originals
- **Server disk** holds derivatives (fast galleries)
- No SMS/WhatsApp; notifications email (or mailto:)
- Uploads always succeed (Drive failure → local disk)
- Per‑studio `drive.file` scope least‑privilege

Ready for your Postgres URL and OAuth client credentials.
?