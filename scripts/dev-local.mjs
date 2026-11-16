/**
 * Local dev on SQLite without editing the committed schema.
 *
 * Prisma only allows one provider per schema file, and this repo commits
 * `provider = "postgresql"` because that is what production runs. So this script
 * borrows the schema for a second: it flips the provider to sqlite, generates
 * the client, puts the Postgres schema straight back, and only then starts
 * `next dev`. The generated client keeps working because it does not re-read the
 * schema at runtime.
 *
 *   npm run dev:local            # generate + next dev on prisma/dev.db
 *   npm run db:local            # generate + push the schema into prisma/dev.db
 *   node scripts/dev-local.mjs -p 3001   # extra args go to `next dev`
 *
 * Env: DATABASE_URL from the shell wins, then .env.local, then .env.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const SCHEMA = path.join(ROOT, "prisma", "schema.prisma");
const pushOnly = process.argv.includes("--push");
const passthrough = process.argv.slice(2).filter((arg) => arg !== "--push");

const POSTGRES = 'provider = "postgresql"';
const SQLITE = 'provider = "sqlite"';

/** Minimal .env reader: KEY="value" / KEY=value, later files win. */
function readEnvFile(file) {
  try {
    const text = readFileSync(path.join(ROOT, file), "utf8");
    const out = {};
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      out[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const env = { ...readEnvFile(".env"), ...readEnvFile(".env.local"), ...process.env };
const databaseUrl = env.DATABASE_URL;

if (!databaseUrl || !databaseUrl.startsWith("file:")) {
  console.error(
    `[dev:local] DATABASE_URL must be a SQLite URL (file:…), got: ${databaseUrl ?? "(unset)"}\n` +
      `[dev:local] Set it in .env.local — e.g. DATABASE_URL="file:./dev.db"`,
  );
  process.exit(1);
}

const original = readFileSync(SCHEMA, "utf8");
if (!original.includes(POSTGRES) && !original.includes(SQLITE)) {
  console.error(`[dev:local] Could not find a datasource provider in ${SCHEMA}`);
  process.exit(1);
}
if (original.includes(SQLITE)) {
  console.warn("[dev:local] schema was left on sqlite — restoring postgresql after generate.");
}

/** Always leave the file on Postgres, even if generate/push fails or we Ctrl-C. */
let restored = false;
function restore() {
  if (restored) return;
  restored = true;
  writeFileSync(SCHEMA, original.replace(SQLITE, POSTGRES));
}

try {
  writeFileSync(SCHEMA, original.replace(POSTGRES, SQLITE));

  const prismaArgs = pushOnly
    ? ["prisma", "db", "push", "--skip-generate"]
    : ["prisma", "generate"];

  const result = spawnSync("npx", prismaArgs, {
    stdio: "inherit",
    env: { ...env, DATABASE_URL: databaseUrl },
  });
  if (result.status !== 0) {
    restore();
    process.exit(result.status ?? 1);
  }

  restore();

  if (pushOnly) {
    console.log(`[db:local] schema pushed to ${databaseUrl}`);
    process.exit(0);
  }

  console.log(`[dev:local] client generated for ${databaseUrl} — starting next dev`);
  const dev = spawnSync("npx", ["next", "dev", ...passthrough], {
    stdio: "inherit",
    env: { ...env, DATABASE_URL: databaseUrl },
  });
  process.exit(dev.status ?? 0);
} finally {
  restore();
}
