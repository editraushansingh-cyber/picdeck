/**
 * Build guard: `prisma/schema.prisma` must be committed with the Postgres
 * provider. Local dev swaps it to SQLite for a few seconds (see
 * scripts/dev-local.mjs); if that swap is ever left behind, a production build
 * would quietly generate a SQLite client and fail at runtime instead.
 */
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const provider = schema.match(/datasource\s+db\s*\{[^}]*provider\s*=\s*"([^"]+)"/)?.[1];

if (provider !== "postgresql") {
  console.error(
    `[schema] prisma/schema.prisma has provider "${provider ?? "unknown"}" — expected "postgresql".\n` +
      `[schema] Fix it before building/deploying: set datasource db { provider = "postgresql" }.\n` +
      `[schema] For local SQLite dev run "npm run dev:local" instead of editing the schema.`,
  );
  process.exit(1);
}

console.log("[schema] provider is postgresql — ok");
