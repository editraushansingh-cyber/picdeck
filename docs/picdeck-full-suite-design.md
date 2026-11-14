# PicDeck — Full Product Suite (all modules)

Source: deep analysis of photonweddifly.com (REA evidence: `ev_320abb`, `ev_23caf9`, `ev_f6000f`,
`ev_419cf1`, `ev_7e9095`, `ev_88c745`, `ev_215d40`, `ev_b1dc06`, `ev_ced61f`).

The first build shipped **Photo Selection** only. This document covers the rest of the suite that was
observed on that site, and the approach used here.

## Modules observed on the target site

Landing page structure (`ev_320abb`): hero → use cases → **Photo Selection** → **AI Face Recognition** →
**Flipbook** → **Products** → referral → pricing → awards → reviews → how it works → FAQ → final CTA.

### 1. Photo Selection (already built, keep)
Private gallery + 6-digit code, client taps favourites, list lands in dashboard.

### 2. AI Face Recognition
Observed: "find every photo of the bride in 3 seconds". A guest/client scans or uploads a selfie and
the gallery returns only photos containing that face. Implemented here as a *seeded, deterministic*
similarity model (no external ML): each uploaded photo gets a synthetic 128-d descriptor derived from
its dominant colours + captured metadata, galleries are searched by cosine similarity against the
probe descriptor. It is honest about being a demo model — the UI says so. Real deployments swap the
`descriptorFor()` function for a face-embedding model.

## Delivered pieces

- `/g/[code]` → “Search by face”: upload a selfie → grid of “matching” photos.
- Dashboard event page → “Face groups” panel: clusters the event's photos into N groups with counts.
- `FaceDescriptor` table, deterministic descriptor + similarity helpers (`lib/face.ts`, 64 colour bins
  + luminance/variance/aspect = 71 numbers).

### 3. Flipbook / Digital Album
Observed: an album builder that turns selected photos into a shareable page-turning album.
Delivered:
- `/dashboard/albums` — every album with page count, views, publish toggle and copy link; albums are
  created from the event page panel.
- `/album/[slug]` — public, unguessable slug, page-flip viewer (CSS 3D), spreads of 2 photos.
- `Album` + `AlbumPage` tables; pages generated from the client's selection (or all photos).

### 4. Invoicing & Quotation
Observed: invoices and quotations with GST, printable, downloadable.
Delivered:
- `/dashboard/invoices` — list, create, `INV-`/`QUO-` numbering, status (DRAFT/SENT/PAID/CANCELLED).
- `/invoice/[id]/print` — dedicated print layout (A4, `@media print`), totals with CGST/SGST or IGST.
- `Invoice` + `InvoiceItem` tables, per-line qty/rate/discount, tax rate per invoice.

### 5. My Website (studio micro-site)
Observed: a studio page on a subdomain without buying a domain.
Delivered:
- `/s/[slug]` — public studio page: cover, about, services, package cards, contact, gallerylinks.
- `/dashboard/website` — edit profile (slug, headline, about, WhatsApp, Instagram), publish toggle.
- `StudioSite` table (1:1 with User); draft/published state, public page 404s when unpublished.

### 6. Invitation Templates
Observed: limited set of wedding invite designs, shareable link.
Delivered:
- `/invite/[slug]` — full-screen invite (hero image, couple names, date, venue, RSVP button).
- `/dashboard/invitations` — pick from 4 templates, edit couple/date/venue, copy share link.
- `Invitation` table, `template` enum string, per-invite slug + RSVP counter.

### 7. Referral program
Observed: referral code at registration, "earn credits".
Delivered:
- `/dashboard/referrals` — share link, list of referred studios, credits earned.
- Existing `referredById` relation becomes the source; `ReferralCredit` ledger row on signup.
- `ReferralCredit` table.

### 8. Notification queue (email)
Delivered as *queue + template*. Email is the only channel — SMS and WhatsApp were removed from this
build by request, so nothing claims to message a phone number:
- `Notification` table (channel = email, to, template, message, status, createdAt).
- `/dashboard/notifications` — compose from templates, preview message body, queued list.
- Server action sends through `RESEND_API_KEY` when present, otherwise returns a `mailto:` link.
- `StudioSite.whatsapp` remains only as a contact number the photographer publishes on their site.

### 9. Client delivery / one-click folder download
Observed: "one-click all-folder download".
Delivered: `/api/events/[id]/download?token=` returns a ZIP of the event's selected photos
(`archiver`), protected by the same gallery unlock or owner session.

## Data model additions

```
FaceDescriptor  id, photoId, vector (JSON), createdAt
Album           id, eventId, slug, title, subtitle, coverPhotoId, published, createdAt
AlbumPage       id, albumId, photoAId, photoBId, caption, position
StudioSite      id, userId, slug, headline, about, services(JSON), whatsapp, instagram, coverPath, published
Invitation      id, userId, slug, template, coupleA, coupleB, eventDate, venue, message, rsvpCount
Invoice         id, userId, eventId?, number, type(INVOICE|QUOTATION), status, issuedAt, dueAt,
                clientName, clientEmail, clientPhone, notes, taxRate, subtotal, discount, total
InvoiceItem     id, invoiceId, description, quantity, rate, amount, position
ReferralCredit  id, userId, referrerId, amountInr, reason, createdAt
Notification    id, userId, eventId?, channel, toName, toPhone, message, template, status, createdAt
```

## Plan gating

| Module | Free | Basic | Silver | Gold | All-Access | Album add-on | AI add-on |
|---|---|---|---|---|---|---|---|
| Photo Selection | 1 event | yes | yes | yes | yes | yes | yes |
| Client download / ZIP | yes | yes | yes | yes | yes | yes | yes |
| Invoices & invitations | yes | yes | yes | yes | yes | yes | yes |
| Studio website | yes | yes | yes | yes | yes | yes | yes |
| Notification queue | yes | yes | yes | yes | yes | yes | yes |
| AI face search | — | — | yes | yes | yes | — | yes |
| Album / flipbook | — | — | yes | yes | yes | yes | — |
| Branding & watermark | yes | yes | yes | yes | yes | yes | yes |

Album packs are Album Basic/Premium/Platinum (₹599–₹1,799/yr); AI packs are AI Basic/Silver/Gold
(₹499–₹1,199/yr). All-Access (₹1,999/yr) includes both.

## Non-goals

Payments (Razorpay), real face embeddings, SMS/WhatsApp delivery. Each has a clearly marked seam
(`lib/face.ts`, `lib/notifications.ts`). Email delivery is behind `RESEND_API_KEY`.

**Storage split:** each studio connects its own Google Drive with OAuth (`lib/drive.ts`,
`drive.file` scope). Originals are written to `PicDeck/<event>/` in that Drive; thumbnails and
watermarked previews stay on the app server (`storage/`), or an S3/R2 backend behind the same
`OriginalSink` interface. Metadata and encrypted refresh tokens live in the database (SQLite in dev,
Postgres in production — see `DATA-LOCATION.md`). Mobile delivery is a PWA, not a native store app.