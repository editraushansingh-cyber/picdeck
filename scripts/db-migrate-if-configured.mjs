/**
 * Applies pending Prisma migrations during `next build` when a database is
 * configured. Preview deployments and local builds without DATABASE_URL skip
 * the step instead of failing the build.
 */
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("[db-migrate] DATABASE_URL is not set — skipping prisma migrate deploy");
  process.exit(0);
}

execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
