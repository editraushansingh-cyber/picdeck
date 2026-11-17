# Upload Compression and Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add quality-controlled image uploads to Google Drive and replace trial accounts with ongoing Free-plan accounts.

**Architecture:** A small shared upload-quality module defines the valid controls and maps user choices to browser encoder quality. `UploadDropzone` prepares only browser-decodable raster files before it calls the unchanged resumable Drive path or local fallback. A nullable subscription end date represents an ongoing free plan without changing limited paid subscription records.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Vitest, Prisma/PostgreSQL, browser Canvas APIs.

**Spec:** `docs/superpowers/specs/2026-11-17-upload-compression-and-signup-design.md`

## Global Constraints

- Keep photo originals in the studio's Google Drive in production; do not move them to Supabase Storage.
- 100% must upload the original unmodified file.
- RAW images must never be transcoded.
- Keep Prisma committed with the PostgreSQL provider and use a new forward-only migration.
- Do not promise fixed output file sizes for encoder-quality values.

## Review Focus

- An unsupported/undecodable raster file falls back to the original rather than failing an entire batch; cover in the upload preparation test.
- RAW file names select original handling even when a quality preset is selected; cover in the quality-selection test.
- A Free subscription with no end date remains active; cover in the active-subscription query test or its predicate helper.
- Existing dated subscriptions remain governed by their expiry; cover the active-subscription predicate.
- Landing, registration, terms, plans, and dashboard do not expose trial wording; cover with a source-level regression assertion where appropriate plus browser smoke testing.

---

### Task 1: Upload quality model and browser preparation

**Files:**
- Create: `src/lib/upload-quality.ts`
- Test: `src/lib/upload-quality.test.ts`
- Modify: `src/components/UploadDropzone.tsx`

**Interfaces:**
- Produces `UPLOAD_QUALITY_OPTIONS`, `UploadQuality`, `qualityForUpload`, and `shouldCompressUpload` for the dropzone.

- [ ] Write failing Vitest cases for original/no-transcode behaviour, JPEG quality presets, and RAW preservation.
- [ ] Run `npm test -- src/lib/upload-quality.test.ts` and confirm the tests fail because the module is missing.
- [ ] Implement the typed quality preset module with only the selector labels and transformation decisions required by the tests.
- [ ] Run the focused test and confirm it passes.
- [ ] Update `UploadDropzone` to show the preset control, prepare supported raster images with Canvas before upload, preserve RAW/unsupported files, and report preparation plus upload progress.
- [ ] Run the focused test and the full suite.

### Task 2: Ongoing Free subscription model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261117120000_ongoing_free_subscriptions/migration.sql`
- Modify: `src/lib/plans.ts`
- Modify: `src/app/actions/auth.ts`
- Modify: `src/app/dashboard/layout.tsx`
- Test: `src/lib/plans.test.ts` (or the existing plans test location)

**Interfaces:**
- Produces an `activeSubscription` lookup that treats `endsAt: null` as ongoing.
- New signups create an `ACTIVE` Free subscription with `endsAt: null`.

- [ ] Write a failing test for the active-subscription condition that includes ongoing Free accounts and excludes expired dated accounts.
- [ ] Run the focused test and confirm it fails for the new condition.
- [ ] Make `Subscription.endsAt` nullable and add the reviewed PostgreSQL migration.
- [ ] Update the plan lookup, signup creation, and dashboard badge for an ongoing Free plan.
- [ ] Run the focused and full test suites, then run `npm run db:local` to prove the schema works locally.

### Task 3: Public account language and release checks

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/SiteChrome.tsx`
- Modify: `src/app/register/page.tsx`
- Modify: `src/app/about/page.tsx`
- Modify: `src/app/terms/page.tsx`
- Modify: `src/app/plans/page.tsx`

**Interfaces:**
- Produces public calls-to-action that say Sign up/Create account instead of starting a trial.

- [ ] Replace trial-specific public and metadata copy with direct login/sign-up and Free-plan copy.
- [ ] Search the public surface for remaining trial promises and correct only user-facing product copy.
- [ ] Run `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run build`.
- [ ] Start local development, use browser automation to smoke-test the landing, signup, login, event upload panel, and public gallery/invoice pages at desktop and mobile widths.
- [ ] Commit the scoped changes and push `main`, then verify the deployed public landing page and a public invoice route.
