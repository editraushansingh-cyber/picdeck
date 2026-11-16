# Codex handover — PicDeck invoice upgrade

Last updated: 2026-11-16
Repo: `picdeck` (Next.js 16 App Router + Prisma + Postgres/Supabase)
Branch that matters: `main` (production deploys from here)

This document is the A-to-Z handover for an agent that has **nothing pre-issued**: no
tokens, no session cookie, no deploy hook. Everything below is either already on disk or
reachable with the credentials that are already configured on this machine. Read it fully
before touching code. If something here disagrees with the repo, trust the repo and update
this doc.

---

## 0. TL;DR

```bash
cd picdeck
npm install
npm run db:local        # sync prisma/dev.db with the schema (SQLite)
npm run db:demo         # seed demo studios + a sent invoice + public link
npm run dev:local       # next dev on http://localhost:3000 using prisma/dev.db
```

- Public demo invoice: <http://localhost:3000/i/demo-invoice-link-token>
- Login without the login form: `npm run --silent session -- demo@picdeck.local`
  prints a real `picdeck_session` cookie value.
- Deploy = `git push origin main` (GitHub → Vercel auto-build). Credentials are cached in
  the macOS keychain, so push works without asking for a token.
- **Never commit secrets.** Read them from disk or from the provider dashboard.

---

## 1. What was done (context for the next task)

The invoice module was rebuilt to match the invoice flow observed in CamTom 7.0.52:

- Grouped line items with per-group subtotals.
- Two pricing modes: item-wise and flat budget total.
- Advance/payment log; print shows exactly three totals: **TOTAL → ADVANCE → BALANCE**.
- **No GST/CGST/SGST anywhere.** Tax columns still exist in the schema but stay `0` and are
  not rendered or calculated.
- Functions schedule (name, date, venue, description).
- Terms: studio default + per-invoice override.
- Numbering `PREFIX/YEAR/NNN` (e.g. `RF/2026/001`), prefix set in studio settings.
- Quotation and Invoice share one design; only the label differs.
- Client-facing public link `/i/<token>`; quotations/invoices are visible only when
  `SENT` or `PAID`.
- WhatsApp share sends a message with the public link (no PDF attachment — the client opens
  the page and saves/prints the PDF from there).
- Photos: originals stay on the studio's Google Drive. Supabase Storage is **not** used for
  photos.

The CamTom evidence behind these decisions lives in
`docs/camtom-reverse-engineering.md` (sections 10–11).

Shipped in commit `73b5120` (`feat(invoice): groups, advance log, budget mode, studio
numbering, client link`), migration `20261115120000_invoice_groups_payments` already
applied to production Postgres.

---

## 2. Repo, remotes, deploy topology

```bash
git remote -v
# origin  https://github.com/editraushansingh-cyber/picdeck.git
```

- `main` → Vercel production. Pushing to `main` triggers a build automatically.
- Nothing else is required: `vercel` CLI and `gh` CLI are **not installed**, and they are
  not needed for a normal deploy. `git push` is the deploy button.
- Git push auth comes from the macOS keychain (`credential.helper=osxkeychain`). Verify
  with `GIT_TERMINAL_PROMPT=0 git ls-remote --heads origin`; it should list `main` without
  prompting.
- The production domain is **not stored in the repo**. Read it from Vercel → project →
  Domains (or ask the user once, then write it into your notes, not into git). Examples in
  `docs/deploy-supabase.md` use `picdeck.vercel.app`, but do not assume that is live.

If you ever need the CLIs:

```bash
npm i -g vercel     # then `vercel login`
brew install gh     # then `gh auth login`
```

Only do this if the task actually needs Vercel project settings or GitHub APIs. A normal
code → test → push loop does not.

### Build chain

`package.json`:

```
build: node scripts/assert-postgres-schema.mjs && prisma generate &&
       node scripts/db-migrate-if-configured.mjs && next build
```

1. `assert-postgres-schema.mjs` fails the build if `prisma/schema.prisma` is not on
   `provider = "postgresql"`.
2. `prisma generate`.
3. `db-migrate-if-configured.mjs` runs `prisma migrate deploy` **when `DATABASE_URL` is
   set** (Vercel has it). Locally without `DATABASE_URL` it skips.
4. `next build`.

So a migration that is committed and pushed is applied during the Vercel build. No manual
prod migration step is needed — but see §8 for how to prepare the migration correctly.

---

## 3. Secrets — where they live (never in git)

`.gitignore` ignores `.env*`, `prisma/dev.db`, `storage/`. Two env files exist on this
machine:

| File | Purpose | Notes |
|---|---|---|
| `.env` | Production values (Postgres/Supabase, auth, Google, Resend, Supabase storage) | Read by Prisma CLI and Next in dev too |
| `.env.local` | Local overrides: SQLite `file:./dev.db`, `STORAGE_PROVIDER=local`, `DEMO_MODE=on` | Wins over `.env` |

Key names (values intentionally omitted — read them from the files or the dashboards):

```
DATABASE_URL
AUTH_SECRET
OTP_MODE
NEXT_PUBLIC_APP_URL
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
RESEND_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STORAGE_PROVIDER
DEMO_MODE            # .env.local only
```

Where the real values come from if you are on a different machine:

- **Vercel** → Project → Settings → Environment Variables: `DATABASE_URL`, `AUTH_SECRET`,
  `NEXT_PUBLIC_APP_URL`, Google OAuth, `RESEND_API_KEY`, Supabase keys,
  `STORAGE_PROVIDER=supabase`.
- **Supabase** → Project → Settings → Database: the pooler connection string used as
  `DATABASE_URL` (`aws-0-ap-southeast-2.pooler.supabase.com`).
- **Google Cloud Console** → OAuth client (redirect `<app>/api/drive/callback`).
- **Resend** → API keys.

Rules:

1. Never print secret values into a commit, a doc, a screenshot, or a chat message.
2. Never commit `.env*`. If a secret was ever pasted into a public place, treat it as
   compromised and rotate it in the provider dashboard; rotation status here is unknown.
3. `NEXT_PUBLIC_APP_URL` in the local `.env` is `http://localhost:3000`. Production must
   have the real domain in Vercel, otherwise OAuth redirects and public links are wrong.

---

## 4. First run on a fresh checkout

Prerequisites: Node (this machine runs v26.13.0), npm, and Prisma via `npx` (already a
dependency). No global installs needed.

```bash
cd picdeck
npm install
npm run db:local     # generates a SQLite client + pushes the schema into prisma/dev.db
npm run db:demo      # idempotent demo seed
npm run dev:local    # starts next dev
```

`npm run db:demo` needs a SQLite URL. It reads `.env.local`, so normally no prefix is
needed; if it complains, be explicit:

```bash
DATABASE_URL="file:$PWD/prisma/dev.db" npm run db:demo
```

Demo accounts after seeding:

| Studio | Email | Prefix | Notes |
|---|---|---|---|
| Demo Studio | `demo@picdeck.local` | `DS` | Gold plan, every module visible |
| Riya Film | `riyafilm3@gmail.com` | `RF` | already present in the current dev DB |

Also seeded: gallery codes `217099` / `999320`, album `/album/demo-reception-album`,
site `/s/demo-studio`, invitation `/invite/demo-ananya-rohan`, invoice `DS/2026/001`
(SENT, total ₹1,18,000, advance ₹60,000, balance ₹58,000) with public token
`demo-invoice-link-token`.

Clickable: <http://localhost:3000/i/demo-invoice-link-token>

---

## 5. Everyday dev loop

```bash
npm run dev:local                 # Next dev on :3000, SQLite
npm run dev:local -- -p 3001      # extra args pass through to `next dev`
npm run db:local                  # push schema changes into prisma/dev.db
npm run db:demo                   # re-seed demo data
npm test                          # vitest, 59 tests
npm run lint
npm run build                     # includes the Postgres-provider guard
```

Why `dev:local` instead of `npm run dev`:

- `prisma/schema.prisma` is committed with `provider = "postgresql"`.
- SQLite dev needs `provider = "sqlite"` for the generated client.
- `scripts/dev-local.mjs` flips the provider, runs `prisma generate`, **immediately
  restores Postgres**, then starts `next dev`. The generated client keeps working because
  it does not re-read the schema at runtime.
- Never leave the schema on sqlite. The build guard will fail, and that is intentional.
- If you edit the schema and need the local client again: `npm run db:local`
  (`prisma db push --skip-generate` inside the swap, then restore).
- Switching back to querying production from the same checkout: run `npx prisma generate`
  with the Postgres schema in place (it is), then provide the Postgres `DATABASE_URL`
  explicitly. Note `.env.local` overrides `.env`, so shell env wins if you pass it inline.

---

## 6. Logging in without asking for a token

Three ways, in order of preference.

### 6.1 Mint a dev session cookie (works now)

```bash
npm run --silent session -- demo@picdeck.local
# prints: <base64url payload>.<hmac>

npm run --silent session -- demo@picdeck.local --curl
# prints: -H 'Cookie: picdeck_session=…'
```

Then:

```bash
C=$(npm run --silent session -- demo@picdeck.local)
curl -s -o /tmp/dash.html -w "%{http_code}\n" \
  -H "Cookie: picdeck_session=$C" http://localhost:3000/dashboard/invoices
```

- `scripts/dev-session.mjs` reproduces `encode()` from `src/lib/auth.ts`: HMAC-SHA256 over
  `"<userId>.<issuedAt>"`, keyed by `AUTH_SECRET`, cookie name `picdeck_session`, 14-day
  expiry. It is a real cookie, not a bypass.
- It reads the **dev SQLite** DB only, on purpose. There is no way to mint a production
  cookie without the production `AUTH_SECRET` (which is in Vercel, not in git).
- If the user asks you to inspect the production dashboard and you have no browser session,
  say so plainly and offer local verification plus a pushed deploy; do **not** invent a
  token or weaken auth.

### 6.2 Demo mode

`.env.local` sets `DEMO_MODE="on"`, which enables `/demo` and signs in
`demo@picdeck.local` without the form. Production does not set the flag, so `/demo` refuses
to sign in there.

### 6.3 Normal login

Email + password. Demo accounts have a placeholder `passwordHash`; they are meant for the
cookie script and `/demo`, not the password form.

---

## 7. Database: local SQLite vs production Postgres

| | Local dev | Production |
|---|---|---|
| Provider | SQLite | PostgreSQL (Supabase pooler) |
| URL source | `.env.local` → `DATABASE_URL="file:./dev.db"` | Vercel env / `.env` |
| File | `prisma/dev.db` (gitignored) | managed |
| Schema source of truth | `prisma/schema.prisma` (always Postgres) | migrations in `prisma/migrations` |

Useful inspection commands:

```bash
sqlite3 prisma/dev.db ".tables"
sqlite3 prisma/dev.db "SELECT number,status,total,advance FROM Invoice;"
```

`psql` is not installed. To browse either database, use Prisma Studio:

```bash
npx prisma studio            # uses .env (production) unless overridden
```

For production data, prefer read-only queries and never run destructive SQL. The invoice
tables are `Invoice`, `InvoiceItem`, `InvoicePayment`.

---

## 8. Migrations

Existing migrations:

```
20261114000000_postgresql_baseline
20261114140000_drive_derivatives
20261114200000_invoice_functions
20261115120000_invoice_groups_payments   # invoice groups + payments + terms/budget
```

Workflow for a schema change:

1. Edit `prisma/schema.prisma` (keep `provider = "postgresql"`).
2. Sync the dev DB: `npm run db:local`.
3. Generate the SQL. `prisma migrate dev` needs a Postgres shadow database and will not
   work against local SQLite, so diff instead:
   ```bash
   npx prisma migrate diff \
     --from-migrations prisma/migrations \
     --to-schema-datamodel prisma/schema.prisma \
     --script > /tmp/next.sql
   ```
   Review the SQL. Add a hand-written migration folder:
   `prisma/migrations/<timestamp>_<name>/migration.sql`.
4. Commit the migration with the schema change.
5. Push to `main`. Vercel's build runs `prisma migrate deploy` before `next build`, so the
   migration lands in production automatically.
6. Verify production: `npx prisma migrate status` with the production `DATABASE_URL`
   inline, and inspect `information_schema.columns` for the new columns.

Do **not** run `prisma db push` against production. Do **not** edit an already-applied
migration; add a new one.

---

## 9. Invoice system — full spec

### 9.1 Data model

`Invoice` (key fields):

| Field | Meaning |
|---|---|
| `number` | Unique, `PREFIX/YEAR/NNN` |
| `type` | `INVOICE` or `QUOTATION` |
| `status` | `DRAFT`, `SENT`, `PAID`, `CANCELLED` |
| `functions` | JSON array `{name, date, venue, desc}` (max 8) |
| `terms` | JSON array of lines (max 12); empty = use studio default |
| `budgetMode`, `budgetAmount` | Flat-total pricing mode |
| `discount`, `extra` | Adjustments |
| `taxRate`, `taxAmount` | Retained for legacy rows; always 0, never printed |
| `subtotal`, `total` | Derived by `computeTotals` |
| `advance` | Sum of `payments`; denormalized for lists |
| `shareable`, `publicToken` | Public link gate + unguessable slug |

`InvoiceItem`: `description`, `quantity`, `rate`, `amount`, `group`, `position`.
`InvoicePayment`: `amount`, `paidAt`, `mode` (`CASH | UPI | CARD | BANK`), `note`,
`position`.

Studio-level defaults on `User`: `invoicePrefix` (2–3 letters, uppercased/sanitized),
`invoiceTerms` (JSON array).

### 9.2 Calculations (`src/lib/invoices.ts`)

- Items mode: `subtotal = Σ(quantity × rate)`; `total = subtotal − discount + extra`
  (both clamped at ≥ 0), rounded to 2 decimals.
- Budget mode: `subtotal = budgetAmount`; item rows stay as an explanation but do not add
  up. **Budget amount is the final total** — no tax-inclusive reverse calculation.
- No tax is ever added. `computeTotals` returns `{ subtotal, total }` only.
- `advance = totalPaid(payments)`; `balance = max(0, total − advance)`.
- Money helper: `round2` (store paise, avoid float drift).

### 9.3 Numbering

`formatInvoiceNumber({ prefix, year, sequence })`:

- Prefix: trimmed, uppercased, non-alphanumerics stripped, max 3 chars.
- Sequence: per studio, padded to 3 (`001`), shared by quotations and invoices, walks
  forward on collision.
- No prefix → `2026/001`; with `RF` → `RF/2026/001`.

### 9.4 Status and public link

- Public route: `/i/[token]`.
- Visible only when `isPubliclyVisible()`: `shareable === true` **and** status is `SENT`
  or `PAID`. Draft/cancelled/`shareable=false` all render 404.
- The token is minted server-side when the status becomes `SENT` (or `PAID`), by
  `setInvoiceStatus` in `src/app/actions/invoices.ts`. Drafts have no usable link.
- `newShareToken()` = 12 random bytes → 24 hex chars.

### 9.5 Print / PDF layout rules

- Shared component `src/components/InvoiceSheet.tsx` drives both the dashboard print route
  and the public page, so quotation and invoice look identical; only the label differs.
- Totals block prints exactly three lines: `TOTAL`, `ADVANCE`, `BALANCE`.
- **No** subtotal, discount, tax, CGST, or SGST line on the printed sheet.
- Grouped items print with a group heading and a group subtotal.
- Functions schedule: name + date + venue + description.
- Terms list, logo, signature, payment details (UPI + bank) all print.
- Print route: `/invoice/[id]/print` (auth required). Public route renders the same sheet
  with a save/print button.

### 9.6 UI flows

- `/dashboard/invoices` — list, filters, totals, status chips.
- `/dashboard/invoices/[id]` — `InvoiceEditor` (items + groups, budget toggle, payments,
  functions, terms, live totals preview) and `InvoicePanels` (status actions, WhatsApp,
  client link).
- `/dashboard/settings` — `StudioSettingsForms` sets `invoicePrefix` and default terms.
- Quotation and invoice share the same editor; `type` changes the label only.

### 9.7 WhatsApp and email

- WhatsApp: `src/components/WhatsAppShare.tsx` opens `wa.me/<phone>?text=…` with a short
  message and the public link. On a draft it first calls `setInvoiceStatus(..., "SENT")`
  so the link is live.
- There is no server-side PDF attachment in the WhatsApp flow. The client opens the public
  page and saves/prints the PDF. Do not claim PDFs are attached.
- Email notifications are the only notification channel for invoice events. No WhatsApp
  API integration exists.

### 9.8 Photos and storage

- Originals go to the studio's own Google Drive (`src/lib/storage.ts`,
  `GOOGLE_OAUTH_*`, `/api/drive/callback`).
- `STORAGE_PROVIDER=supabase` in production is used for non-photo/derived objects only;
  do **not** move client photo originals to Supabase Storage.
- Local dev uses `STORAGE_PROVIDER=local` under `storage/` (gitignored).

---

## 10. Code map

| Path | What it does |
|---|---|
| `prisma/schema.prisma` | Data model; always Postgres provider |
| `prisma/migrations/20261115120000_invoice_groups_payments/` | Invoice groups/payments/terms/budget migration (applied to prod) |
| `src/lib/invoices.ts` | Totals, numbering, terms, tokens, payment modes, amount in words |
| `src/lib/invoices.test.ts` | 21 unit tests for the above |
| `src/app/actions/invoices.ts` | Save/update/status, parsing, token minting |
| `src/components/InvoiceEditor.tsx` | Editor with groups, budget mode, payments, functions, terms |
| `src/components/InvoicePanels.tsx` | Status actions, WhatsApp, client link |
| `src/components/InvoiceSheet.tsx` | Shared print/public sheet |
| `src/components/PaymentsEditor.tsx` | Payment log rows |
| `src/components/FunctionsEditor.tsx` | Function schedule rows (4 fields) |
| `src/components/StudioSettingsForms.tsx` | Prefix + default terms |
| `src/app/invoice/[id]/print/` | Authenticated print/PDF route + `invoice.css` |
| `src/app/i/[token]/page.tsx` | Public client-facing invoice/quotation |
| `src/app/dashboard/invoices/` | List + editor pages |
| `scripts/assert-postgres-schema.mjs` | Build guard |
| `scripts/dev-local.mjs` | SQLite dev without editing the committed schema |
| `scripts/dev-session.mjs` | Dev session cookie minting |
| `scripts/db-migrate-if-configured.mjs` | `prisma migrate deploy` during build |
| `prisma/seed-demo.ts` | Idempotent demo data incl. `DS/2026/001` |
| `docs/camtom-reverse-engineering.md` | CamTom evidence (sections 10–11) |

---

## 11. Verification playbook (run before claiming done)

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build          # schema guard + generate + build
```

Then a live smoke test on `dev:local`:

```bash
npm run dev:local &
C=$(npm run --silent session -- demo@picdeck.local)

curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: picdeck_session=$C" \
  http://localhost:3000/dashboard/invoices
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/i/demo-invoice-link-token
```

Expected: `200` and `200`. To prove the draft gate, create/keep a draft token and confirm
it returns `404`.

Regression points worth re-checking after invoice changes:

- Item mode totals and group subtotals.
- Budget mode: `subtotal === total` (before discount/extra), rows do not add up.
- No tax anywhere in UI, HTML, or PDF.
- Three-line totals only: TOTAL / ADVANCE / BALANCE.
- Advance = sum of payments; balance never negative.
- Numbering increments per studio and quotation/invoice share the counter.
- Draft public link → 404; SENT/PAID → 200.
- Terms fallback: empty invoice terms use studio default; non-empty overrides.
- Functions print all four fields.

Kill dev server when done: `pkill -f "next dev"`.

---

## 12. Deploy, verify, rollback

Deploy:

```bash
git add -A
git commit -m "feat(invoice): …"
git push origin main
```

- Vercel builds automatically. If the build fails, read the Vercel build log (project →
  Deployments → build) or run `npm run build` locally first — the guard catches the most
  common mistake (schema left on sqlite).
- Verify the deploy by loading the production URL: `/i/<token>` for a SENT invoice,
  `/dashboard/invoices` after login.
- Migrations run during the build (`prisma migrate deploy`), so a migration failure fails
  the deploy, not the running app.

Rollback:

- Fast: Vercel → Deployments → previous deployment → Promote.
- Code: `git revert <sha> && git push origin main`.
- Database: migrations are forward-only here; write a compensating migration. Do not hand-
  edit production tables.

---

## 13. Screenshots and PDFs

The in-app screenshot tool is unreliable. Use Playwright from the pre-approved venv:

```bash
/Users/tma/.local/share/cline-tools/venv/bin/python - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1200, "height": 1500}, device_scale_factor=2)
    r = pg.goto("http://localhost:3000/i/demo-invoice-link-token", wait_until="networkidle")
    print("status", r.status)
    pg.locator("article.pd-sheet").screenshot(path="/tmp/invoice.png")
    pg.pdf(path="/tmp/invoice.pdf", format="A4", print_background=True)
    b.close()
PY
```

Approved design artifacts live in `../picdeck-invoice-demo/`
(`20-blush-ivory-groups-advance.{png,pdf}`). Keep new artifacts out of the repo unless the
user asks for them.

---

## 14. Known pitfalls

1. **Schema provider.** `prisma/schema.prisma` must be committed as `postgresql`. Use
   `npm run dev:local` / `npm run db:local`; do not hand-edit the provider. The build guard
   exists because a sqlite schema would generate a sqlite client and break production.
2. **Generated client drift.** After `dev:local`, the client is sqlite. Run
   `npx prisma generate` before querying Postgres from that checkout.
3. **`.env.local` wins over `.env`.** A shell-inline `DATABASE_URL` wins over both.
4. **Next.js 16 is not the Next you know.** `AGENTS.md` says it; read
   `node_modules/next/dist/docs/` before using unfamiliar APIs.
5. **`AGENTS.md` managed block.** `next dev` rewrites the
   `BEGIN/END:nextjs-agent-rules` block. Commit it as-is; do not fight it. Put project notes
   outside the block.
6. **Seed idempotency.** `seed-demo` deletes and recreates its own rows. Slugs
   (`Album.slug`, `StudioSite.slug`, `Invitation.slug`) and short codes
   (`referralCode`, `studioCode`) are globally unique, so it also clears clashing rows from
   other studios (`demo-studio-2`, `DEMO02` fallbacks). Keep those guards.
7. **Tax fields.** `taxRate`/`taxAmount` remain in the schema for old rows. They must stay
   0 for new documents and must never render. Do not "restore GST" without an explicit
   product decision.
8. **Budget mode is final.** `budgetAmount` is the total; discount/extra still apply, but
   there is no reverse tax calculation. Item rows are descriptive only.
9. **Public link gate.** Do not make `/i/[token]` resolve drafts. The token is minted only
   when status becomes SENT/PAID, and `isPubliclyVisible` is the single source of truth.
10. **WhatsApp = link, not attachment.** `wa.me` cannot attach a PDF. Do not describe it as
    sending a PDF file.
11. **No `psql`, no `gh`, no `vercel`.** Use `npx prisma studio`, git, and the dashboards.
12. **Secrets already leaked once.** Treat GitHub PAT / Vercel token / Supabase keys /
    Google secret as potentially compromised; rotate in the provider UI if the user asks.
    Never paste values into docs or commits.
13. **Storage provider.** Photos stay on Google Drive. Supabase Storage is not the photo
    backend.

---

## 15. Open items / sensible next steps

- Users' `invoicePrefix`/`invoiceTerms` are unset until they visit settings; numbering then
  falls back to `YEAR/NNN` and terms to an empty list. A first-run prompt could help.
- The invoice list still shows legacy rows with 18% tax from before the upgrade. They are
  historical; new rows are tax-free. A one-off data cleanup was not requested.
- Public page has no "download PDF" server endpoint; clients use the browser's print/save.
  If a real PDF attachment is wanted later, add server-side rendering (e.g. Playwright) and
  attach it through the email provider.
- No invoice email templates exist yet; notifications are queued generically. The only
  outbound share path is WhatsApp link.
- No end-to-end test covers the public route; unit tests cover calculations, numbering,
  terms, tokens.

---

## 16. Command cheat sheet

```bash
# dev
npm run db:local                       # push schema -> prisma/dev.db
npm run db:demo                        # seed demo studios + invoice
npm run dev:local                      # next dev (SQLite)
npm run db:seed                        # production-ish seed (Postgres URL required)

# auth
npm run --silent session -- demo@picdeck.local
npm run --silent session -- demo@picdeck.local --curl

# checks
npx tsc --noEmit && npm run lint && npm test && npm run build

# database
sqlite3 prisma/dev.db ".tables"
npx prisma studio
npx prisma migrate status              # with production DATABASE_URL
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma --script

# deploy
git push origin main                   # Vercel auto-build
pkill -f "next dev"
```
