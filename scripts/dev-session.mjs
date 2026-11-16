/**
 * Prints a ready-to-use session cookie for the local dev database, so an agent
 * (or you) can open dashboard routes with curl / Playwright without going
 * through the login form.
 *
 *   node scripts/dev-session.mjs                      # first user in the dev DB
 *   node scripts/dev-session.mjs riyafilm3@gmail.com   # a specific studio
 *   node scripts/dev-session.mjs --curl riyafilm3@gmail.com
 *
 * It reproduces `encode()` from src/lib/auth.ts (HMAC-SHA256 over
 * "<userId>.<issuedAt>", keyed by AUTH_SECRET), so the cookie is a real one and
 * expires on its own after 14 days. Dev only — it reads the SQLite file.
 */
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const asCurl = args.includes("--curl");
const email = args.find((arg) => !arg.startsWith("--"));

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
const secret = env.AUTH_SECRET;
if (!secret) {
  console.error("[session] AUTH_SECRET is not set in the shell, .env.local or .env");
  process.exit(1);
}

const databaseUrl = env.DATABASE_URL ?? "";
if (!databaseUrl.startsWith("file:")) {
  console.error(
    `[session] Only the local SQLite database is supported, got: ${databaseUrl || "(unset)"}\n` +
      `[session] Run "npm run dev:local" once so .env.local points at prisma/dev.db.`,
  );
  process.exit(1);
}

// "file:./dev.db" is relative to prisma/ (Prisma's convention).
const dbPath = path.resolve(ROOT, "prisma", databaseUrl.replace(/^file:/, "").replace(/^\.\//, ""));
const db = new DatabaseSync(dbPath);

const user = email
  ? db.prepare("SELECT id, name, email FROM User WHERE email = ?").get(email)
  : db.prepare("SELECT id, name, email FROM User ORDER BY rowid LIMIT 1").get();

db.close();

if (!user) {
  console.error(`[session] No user found${email ? ` for ${email}` : ""} in ${dbPath}`);
  console.error('[session] Seed the demo studio first: npm run db:demo');
  process.exit(1);
}

const payload = `${user.id}.${Date.now()}`;
const b64 = Buffer.from(payload).toString("base64url");
const signature = crypto.createHmac("sha256", secret).update(b64).digest("base64url");
const token = `${b64}.${signature}`;

console.error(`[session] ${user.name} <${user.email}> (${user.id})`);

if (asCurl) {
  console.log(`-H 'Cookie: picdeck_session=${token}'`);
} else {
  console.log(token);
}
