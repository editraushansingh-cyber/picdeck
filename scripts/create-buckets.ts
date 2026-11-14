// Create buckets if they don't exist
// Load environment variables before importing supabase
import 'dotenv/config';
import { ensureBuckets } from '../src/lib/supabase';

async function main() {
  console.log('Supabase URL:', process.env.SUPABASE_URL);
  console.log('STORAGE_PROVIDER:', process.env.STORAGE_PROVIDER);
  try {
    await ensureBuckets();
    console.log('Buckets ensured.');
  } catch (e: any) {
    console.log('Buckets ensure error:', e?.message || String(e));
  }
}

if (require.main === module) {
  main();
}