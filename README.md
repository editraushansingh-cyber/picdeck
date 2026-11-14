# PicDeck — the studio suite for wedding photographers

Private client galleries, digital albums, face search, invoices, invitations, a one-page studio
site and client reminders — from one dashboard.

The core flow: share a link or a six-digit code, the client taps the photos they want, and the
selection lands in your dashboard with a download button next to it. Everything else is built on
top of that same event.

## Modules

| Module | Where | Plan |
|---|---|---|
| Photo selection + client gallery | `/g/[code]`, dashboard | all |
| One-click folder download (`.zip`) | `/api/events/[id]/download` | all |
| AI face search + named groups | `/g/[code]` → “Find your photos” | Silver+ / AI plans |
| Album / flipbook (flip, music, cover, QR) | `/album/[slug]`, `/dashboard/albums/[id]` | Silver+ / Album plans |
| Invoices & quotations | `/dashboard/invoices`, `/invoice/[id]/print` | all |
| Invitation templates | `/dashboard/invitations`, `/invite/[slug]` | all (2 / 25 / 200) |
| Studio website + custom domain | `/dashboard/website`, `/s/[slug]` | all |
| Client notification queue (email) | `/dashboard/notifications` | all |
| Own Google Drive for originals (OAuth) | `/dashboard/settings` | all |
| Studio branding, logo & watermark | `/dashboard/settings` | all |
| Lifetime album QR + all-events studio QR | `/dashboard/albums/[id]/qr`, `/studio/[code]` | all |
| Background library | `/dashboard/backgrounds` | all |
| Installable mobile app (PWA) | `/manifest.webmanifest`, `/offline` | all |
| Referral credits | `/dashboard/referrals` | all |

Blueprints and the gating matrix: `docs/picdeck-full-suite-design.md`.

## Run it

```bash
npm install
npx prisma migrate dev        # creates prisma/dev.db
npm run db:seed               # inserts Free, Basic / Silver / Gold, All-Access, Album and AI plans
npm run db:demo               # optional: demo studio on Gold with sample everything
npm run dev                   # http://localhost:3000
```

`.env`:

```
DATABASE_URL="file:./dev.db"                 # production: postgresql://…
AUTH_SECRET="change-me-in-production"        # also encrypts stored Drive tokens
DEMO_MODE="on"                               # local only: enables /demo
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Own Google Drive per studio (one OAuth client for the whole app).
GOOGLE_OAUTH_CLIENT_ID=""
GOOGLE_OAUTH_CLIENT_SECRET=""

# Optional integrations — the app stays on local disk / queued messages without them.
RESEND_API_KEY=""
MAIL_FROM="PicDeck <hello@yourstudio.in>"
CUSTOM_DOMAINS="studio.example.com=demo-studio"
```

`DEMO_MODE="on"` enables `/demo`, which signs in a demo studio (`demo@picdeck.local`) without the
sign-up form. In production the flag is absent and `/demo` refuses to sign anyone in.

Registration is email + password only — there is no SMS/OTP step, and new studios start on the
**Free** plan (one active event).

### Google Drive for originals

1. Google Cloud Console → enable **Google Drive API** → OAuth consent screen (External) →
   Credentials → **OAuth client ID → Web application**.
2. Authorised redirect URI: `<NEXT_PUBLIC_APP_URL>/api/drive/callback`.
3. Put the client id/secret in `.env`, restart, then `/dashboard/settings` → **Connect Google Drive**.

Each studio connects its own Google account with the `drive.file` scope only, so the app can touch
files it created and nothing else. Originals land in `PicDeck/<event title>/`; refresh tokens are
stored AES-256-GCM encrypted. Thumbnails and watermarked previews never leave the server, so
galleries stay fast. If Drive errors mid-upload the photo is kept on local disk and the row records
`originalStore = LOCAL`. See `DATA-LOCATION.md` for the full data map.

### Postgres in production

The schema is portable; only `AUTH_SECRET` and the URLs change. Point `DATABASE_URL` at Postgres
(Neon/Supabase free tier is enough), then `npx prisma migrate deploy && npx prisma generate`. The
generated Postgres SQL is SQLite-flavoured only because `prisma/dev.db` is SQLite — regenerate the
migration from the Postgres URL when you switch (`prisma migrate diff --from-empty
--to-schema-datamodel prisma/schema.prisma`) for the first deployment.

## What a photographer can do

1. Register with email + password (phone kept for invoices only), login with email or password.
2. Create an event with a date, client name/phone, a note, a selection limit and download rules.
   Every event gets a private six-digit gallery code.
3. Upload photos (drag and drop, up to 20 per batch, 25 MB per file, JPEG/PNG/WebP/HEIC/TIFF and
   common RAW). Originals go to the studio's own Google Drive when connected (local disk otherwise);
   thumbnails (480 px) and watermarked previews (1600 px) are generated with `sharp` and stay on the
   server. RAW files are indexed from their largest embedded JPEG preview, and the studio
   watermark (logo + text) is burned into new previews.
4. Share the gallery link (which carries the code) or the six-digit code, with a QR code.
5. See the selection list the moment a client sends it, and download only the selected files —
   or the whole folder as a ZIP.
6. Turn the selection into a flipbook album with cover art, background music, re-arrangeable
   spreads and a lifetime QR; group the event into named face sets, and print an invoice.
7. Publish a one-page studio site (optionally on a custom domain), send invitation links, queue
   email reminders, and track referral credits.
8. Regenerate the code, change rules, archive the event, or delete it (files are removed too).
9. Install the dashboard as an app (PWA) on a phone; the shell works offline.

## What a client can do

Open `/g` (or the shared link, or scan the QR), pick photos up to the limit, optionally type a name
and phone, and send. No account, no app. The list can be edited and sent again. On Silver+ galleries
they can also upload a selfie to filter the gallery, and download everything in one ZIP when the
studio allows it.

## Honest seams

These are deliberate, single-file swap points rather than fake integrations:

- **Face search** — `src/lib/face.ts#descriptorFor()` builds a deterministic colour/aspect
  descriptor (64 colour bins + luminance + aspect, cosine search, k-means grouping). Replace it with
  a face-embedding model; everything downstream already consumes vectors.
- **Notifications** — `src/lib/notifications.ts` holds templates and the `mailto:` builder. With
  `RESEND_API_KEY` set, `src/lib/mail.ts` sends email server-side; without it the message is queued
  with a `mailto:` link. SMS and WhatsApp delivery are intentionally not implemented — no screen
  claims otherwise.
- **Google Drive** — `src/lib/drive.ts` implements the per-studio OAuth flow
  (`connect` → `callback` → `DriveLink`), token refresh, folder creation, upload/download/delete.
  Without `GOOGLE_OAUTH_CLIENT_*` the Connect button is disabled and originals stay on local disk.
- **Live gallery sync** — `src/lib/gallery-events.ts` (in-memory hub), `src/app/api/events/[id]/stream`
  (Server-Sent Events with `Last-Event-ID` replay from the `SelectionEvent` table) and
  `src/components/useGalleryStream.ts` (one shared connection per event, polling fallback). A client
  tap reaches the studio dashboard in about a second, and an upload's `photo-ready` event adds the new
  tiles to an open client gallery. The hub is per-process: running more than one app instance needs a
  shared bus (Postgres `LISTEN/NOTIFY` or Redis) behind `publish()`; until then a cross-instance write
  shows up on the next poll.
- **Object storage** — `StorageConnection` + `src/lib/storage.ts` keep previews on disk; an S3/R2
  backend slots in behind the same `OriginalSink` shape.
- **Payments** — plan gating works from `Subscription` rows, but collection is manual: registration
  starts the Free plan, and assigning any paid plan (Basic, All-Access, Album, AI) is a database
  action today.
- **Backgrounds** — `src/lib/backgrounds.ts` renders eight 2000 px flattened backdrops. Swap the
  renderer for a file lookup when a layered PSD pack is supplied.
- **Mobile app** — a PWA (manifest + service worker + icons), not a native binary. Store listings
  and push notifications are out of scope.

## Security notes

- Gallery access requires the code. Entering it sets an HttpOnly per-event cookie for 12 hours.
- Failed attempts are counted per device per gallery (5 / 15 min), per gallery (20 / 15 min) and per
  device overall (10 / 15 min, which also covers codes that match nothing).
- Photos are served through `/api/photos/[id]/file` with permission checks. Clients can only get
  what the event allows: preview downloads and originals are switchable per event.
- Album photos are public only through a published album slug, and only previews are served.
- Invoices, albums, sites, invitations and notifications are all scoped to the owning studio.
- Regenerating the code invalidates the old one immediately.
- Passwords are bcrypt-hashed; sessions are signed HttpOnly cookies.

## Limits

- Derivatives (thumbnails, watermarked previews, logos, covers, music) live on local disk under
  `storage/` (git-ignored); originals go to each studio's Google Drive once connected. Object storage
  for multi-instance hosting is a single adapter. ZIP downloads are streamed and buffered in memory
  per request.
- No external face model or payment gateway is bundled (see seams above). Email and Drive activate
  with keys. SMS and WhatsApp are not part of this build.
- Custom domains need DNS plus the `CUSTOM_DOMAINS` proxy mapping because the proxy cannot query
  Prisma.

## Stack

Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4, Prisma 6 (SQLite in dev, Postgres in production), `sharp`,
`qrcode`, `archiver`.
