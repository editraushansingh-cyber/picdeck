import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Thin Supabase client for object storage and (later) Postgres. Only the parts
 * the app uses are exposed here; the rest of the app keeps working with a
 * simple store abstraction so a bare Postgres/Neon or S3/R2 backend can slot in
 * behind the same calls (see lib/object-store.ts).
 */
let _client: SupabaseClient | null = null;

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function supabaseConfigured() {
  return !!supabaseConfig();
}

export function supabase(): SupabaseClient {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured");
  if (!_client) {
    _client = createClient(config.url, config.anonKey, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

/**
 * Service-role client for server-only writes. The anon key is fine for public
 * reads through permissioned buckets; writes/management use the service role so
 * we are never blocked on the auth RLS row for the studio.
 *
 * This must NEVER be imported into a client component (the key is secret).
 */
export function supabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured");
  return createClient(config.url, serviceKey, { auth: { persistSession: false } });
}

export function buckets() {
  return {
    photos: "photos",
    assets: "assets",
  } as const;
}

/**
 * Ensures the two storage buckets exist. Safe to call at deploy/boot time and
 * idempotent — Supabase returns an "already exists" error we swallow. Public
 * read policy for the `photos` bucket is applied in the SQL migration (see
 * docs/deploy-supabase.md) because RLS policies are SQL, not client API.
 */
export async function ensureBuckets(): Promise<void> {
  const list = buckets();
  const client = supabaseAdmin();
  for (const name of Object.values(list)) {
    const { error: createError } = await client.storage.createBucket(name, {
      public: name === "photos",
    });
    // 409 / "already exists" is fine.
    if (createError && !/already exists/i.test(createError.message)) {
      throw new Error(`bucket ${name}: ${createError.message}`);
    }
  }
}