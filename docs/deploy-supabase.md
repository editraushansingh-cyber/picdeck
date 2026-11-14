# PicDeck Deployment with Supabase

## Supabase Setup (Mumbai region)

1. Go to [supabase.com](https://supabase.com) → **New project**
   - Name: `picdeck-prod`
   - Database password: (strong, save)
   - **Region**: `Mumbai (ap-south-1)`
   - Create

2. Once created, go to **Project Settings** → **Database** → **Connection string**
   - Copy **URI** (format: `postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`)
   - Paste into `.env` as `DATABASE_URL`
   - **Important**: Prisma datasource `provider` must be `"postgresql"` (`prisma/schema.prisma`), not `"sqlite"`. (Migration script next.)

3. **Storage buckets** (Supabase Storage)
   - In Supabase UI: **Storage** → **Create bucket**
   - `photos` → **Public** ☑️ **Enable public access**
   - Create bucket
   - `assets` → **Public** ☑️ **Enable public access**
   - Create bucket

   *Alternatively*: run `ensureBuckets()` via the CLI (or call the function at startup).

4. **Set environment variables** (`.env` for local, **Vercel Environment Variables** for deploy):

| Variable | Purpose | Example |
|----------|---------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | **anon** public key (found in **Project Settings** → **API**) | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** secret key (same settings page) | `eyJ...` |
| `STORAGE_PROVIDER` | **supabase** (production) or `local` (dev) | `supabase` |
| `DATABASE_URL` | Postgres connection string | `postgresql://post...` |
| `GOOGLE_OAUTH_CLIENT_ID` | Already set in `env` |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Already set in `env` |

5. **Storage bucket policy (SQL)** (Required for anonymous gallery clients):
   In Supabase SQL Editor, run:
   ```sql
   -- Enable public reads of the `photos` bucket
   CREATE POLICY "public_read_photos" ON storage.objects
   FOR SELECT
   TO public
   USING (bucket_id = 'photos');
   
   -- Enable service-role full access to both buckets (for writes)
   CREATE POLICY "service_full_access" ON storage.objects
   TO service_role
   USING (true)
   WITH CHECK (true);
   ```

## Prisma Schema Migration

1. **Switch provider**: Edit `prisma/schema.prisma`
   Change:
   ```
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
   to:
   ```
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. **Run migrations** (this will push schema to Supabase Postgres):
   ```
   npx prisma migrate deploy
   ```
   (If `prisma migrate` fails due to missing migrations, first run `npx prisma db push`.)

3. **Regenerate client**:
   ```
   npx prisma generate
   ```

## Vercel Deployment

1. **Connect GitHub repo** to Vercel
2. **Set environment variables** (as above)
3. **Deploy branch** `main` (Next.js app)
4. **Ensure** `NEXT_PUBLIC_APP_URL` = your Vercel domain (`https://picdeck.vercel.app`)

## Bucket creation script (optional)

Included `ensureBuckets()` function creates the buckets if missing. Trigger via a one‑time script:

```ts
import { ensureBuckets } from "@/lib/supabase";
await ensureBuckets();
```

or run via `npm run db:bootstrap` (add script to `package.json`).

## Post‑deploy verification

1. **Photo upload**: Ensure thumb/preview generate and upload to Supabase Storage (`photos` bucket)
2. **Gallery load**: Client `/g/<code>` should fetch thumbnails from Supabase
3. **Download**: Owner ZIP download works (originals from Drive, previews from Supabase)
4. **Live sync**: SSE and selection events work (in‑memory hub; multi‑instance requires shared bus)

## Production environment template (`.env.production`)

```env
DATABASE_URL=postgresql://postgres...
NEXT_PUBLIC_APP_URL=https://picdeck.vercel.app
AUTH_SECRET=# generate with `openssl rand -base64 32`
RESEND_API_KEY=

# Google Drive OAuth (same as local)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STORAGE_PROVIDER=supabase

# Optional
DEMO_MODE=off
OTP_MODE=off
```

---

**✅ Storage refactor complete** — `storePhoto` writes thumb/preview to Supabase Storage, originals to Drive, album assets (`cover`, `logo`, `music`) to Supabase.

Next steps:
1. Switch to Postgres SQL (update `prisma/schema.prisma`)
2. Run `npx prisma migrate deploy`
3. Add `SUPABASE_*` env vars
4. Deploy to Vercel.

Questions? Open an issue.