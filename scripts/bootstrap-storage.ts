/**
 * One-shot storage bootstrap: creates the Supabase Storage buckets if missing.
 * Run after setting SUPABASE_* env vars (the script loads .env itself):
 *
 *   npx tsx scripts/bootstrap-storage.ts
 */
import path from "path";

// Load .env from the project root (Node 20.6+ has process.loadEnvFile).
process.loadEnvFile(path.join(process.cwd(), ".env"));

import { ensureBuckets, buckets } from "../src/lib/supabase";

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY must be set in .env");
    process.exit(1);
  }
  await ensureBuckets();
  console.log(`Buckets ready: ${Object.values(buckets()).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
