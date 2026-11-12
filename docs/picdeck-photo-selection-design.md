# PicDeck — Photo Selection Module (Design)

## Intent

Build the complete Photo Selection product for wedding/event photographers, matching the observed
behavior of photonweddifly.com's Photo Selection plan, with the security and trust defects fixed.

## Evidence base

All observed behavior below comes from REA evidence records:

- `ev_320abb…` `analyze_web_bundle` (home) — `/otp/send` static candidate
- `ev_23caf9…` `analyze_web_bundle` (/register) — OTP fetch call site
- `ev_f6000f…` `analyze_web_bundle` (/plans) — plan content is client-side tabs
- `ev_419cf1…` `analyze_web_bundle` (/selection/auth) — 6-digit `auth_code` form
- `ev_b1dc06…` `capture_browser_scenario` — pricing tabs cause zero network requests
- `ev_ced61f…` `capture_browser_scenario` — "Get Started" navigates to `/register`

Observed facts from page content (fetch):

| Observed | Value |
|---|---|
| Register fields | country_code, phone, OTP (6 digit), name, profession, email, pin_code, city, billing_address, password, confirmation, referral_code, consent checkbox |
| OTP contract | `POST /otp/send`, JSON `{country_code, phone}`, header `X-CSRF-TOKEN`, response `{success, message}`, 30s resend cooldown, phone becomes readOnly |
| Register button | enabled only when OTP sent AND consent checked |
| Client access | 6-digit `auth_code`, submit enabled at exactly 6 digits, no other client validation observed |
| Plans (Photo Selection) | Basic ₹249/mo, Silver ₹899/6mo, Gold ₹1,399/yr |
| Plan feature list | Unlimited customers, unlimited photo upload, app, one-click all-folder download, high-speed upload/download, RAW support, client compressed download, download permission on/off, invoice+quotation, "My Website" without domain, invitation templates (limited), WhatsApp notifications (extra charges) |
| Landing copy structure | hero, use cases, photo selection, AI face, flipbook, products, referral, pricing, awards, reviews, how it works, FAQ, final CTA |

## Goals

1. Photographer can register (phone OTP), log in, create an event, upload photos, share a gallery with a client.
2. Client enters a 6-digit code (or opens a link containing the code), views photos, selects favourites, submits.
3. Photographer sees the selection instantly and downloads the selected list.
4. Plan gating for the Photo Selection product (Basic/Silver/Gold).

## Non-goals (this module)

AI face recognition, flipbook, invoice generator, "My Website", WhatsApp messaging, payments.

## Anti-goals

- Fabricated live-purchase toasts, stock-photo testimonials, "Verified" labels without verification.
- Unlimited auth-code guessing.
- Silent public galleries.

## Approaches considered

1. **Next.js App Router + Prisma + SQLite + local file storage** (chosen). Zero external services, one
   command to run, can move to Postgres and object storage later by changing two adapters.
2. Laravel/PHP mirroring the original. Same stack as the target but slower to iterate here, no PHP runtime installed.
3. Next.js + Supabase (hosted Postgres/Auth/Storage). Requires accounts/keys; not runnable offline.

## Design

### Stack

- Next.js (App Router, TypeScript), Tailwind CSS
- Prisma + SQLite (`prisma/schema.prisma`), file storage under `storage/uploads` via a storage adapter
- Session auth with HttpOnly cookie, bcrypt password hashing
- Server Actions / route handlers for all mutations; CSRF is not needed for same-site cookie + SameSite=Lax

### Data model

```
User      id, name, email(unique), phone(unique), passwordHash, profession, city, pinCode,
          address, countryCode, referralCode, referredById, emailVerifiedAt, createdAt
OtpCode   id, phone, codeHash, purpose, expiresAt, consumedAt, attempts, createdAt
Event     id, userId, title, eventDate, clientName, clientPhone, note,
          selectionLimit, downloadEnabled, originalDownloadEnabled, galleryCode,
          status(ACTIVE|ARCHIVED), createdAt
Photo     id, eventId, filename, originalName, mimeType, sizeBytes, width, height,
          thumbPath, previewPath, createdAt
Selection id, eventId, photoId, clientName, clientPhone, createdAt   (unique eventId+photoId)
Plan      id, slug, name, priceInr, periodMonths, product, features(JSON)
Subscription id, userId, planId, startsAt, endsAt, status
```

### Flows

1. `/register` — three-step single page: phone (+country) → Send OTP → 6-digit code → profile + password + optional referral code. Button enabled only when OTP verified and consent checked.
2. `/login` — email or phone + password.
3. `/dashboard` — list events, quota from active subscription, create event button.
4. `/dashboard/events/[id]` — upload (dragging), photo grid, share panel showing gallery link + 6-digit code, selection results, download selected.
5. `/g/[code]` — client gallery. Code is required; if not supplied in URL the client types it at `/g`. Session cookie marks the gallery unlocked for that event only.
6. `/g/[code]/select` — selection UI, limit enforcement, submit.

### Gallery access hardening (fixes the observed weakness)

- 6-digit code is high entropy only if guessing is bounded: 5 failed attempts per event+IP per 15 minutes,
  20 per event per hour, then 15-minute lockout. Attempts are counted server-side.
- Optional per-client PIN extension is not included (kept same as original: single code).
- Code is regenerated by the owner; old code stops working immediately.
- `/g/[code]` sets an HttpOnly per-event cookie after successful code entry; direct link access also requires the code.

### Storage

Adapter interface `put/read/delete`, default local disk under `storage/`, thumbnails generated with `sharp`
(webp, 480px and client preview 1600px, original kept). RAW files are stored as-is and shown with a
placeholder tile, download only.

### Limits and abuse protection

- Upload: 60 files per request batch, 25 MB per file.
- OTP: 1 per 60 s per phone, 5 per hour, code expires in 10 minutes, 5 verify attempts.
- Selection: limit enforced server-side; client can edit until submit.

### Plan gating (Photo Selection only)

Basic ₹249/mo (1 studio profile, unlimited events) · Silver ₹899/6mo · Gold ₹1,399/yr. Trial: 14 days
without payment. Plan check is a single server function `assertPhotoSelectionPlan(userId)`.

## Left to the builder

Exact visual design, copy, icon set, thumbnail quality, and pagination sizes.