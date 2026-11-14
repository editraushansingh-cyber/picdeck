// Connectivity + bucket bootstrap check.
// Runs under tsx so it can import TS beyond the app's Next loader.
process.loadEnvFile?.(".env");
import { supabaseAdmin, ensureBuckets } from "../src/lib/supabase";

async function main() {
  console.log("PROVIDER:", process.env.STORAGE_PROVIDER);
  console.log("URL:", process.env.SUPABASE_URL);
  console.log("ANON set?", !!process.env.SUPABASE_ANON_KEY);
  console.log("SERVICE set?", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const client = supabaseAdmin();
    const { data, error } = await client.storage.listBuckets();
    if (error) {
      console.log("LIST_BUCKETS_ERROR:", error.message, error.status);
    } else {
      console.log("BUCKETS:", data?.map((b) => b.name).join(", "));
    }
  } catch (e: any) {
    console.log("CONNECT_ERROR:", e?.message || String(e));
  }
}

main();