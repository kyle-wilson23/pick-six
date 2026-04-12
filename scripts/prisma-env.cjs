/**
 * Prisma CLI only loads `.env` from the project root, not `.env.local` (Next.js does).
 * Load both so DATABASE_URL / DIRECT_URL can live only in `.env.local` for local dev.
 */
const { config } = require("dotenv");
const { existsSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) {
    config({ path: file, override: true });
  }
}

// `schema.prisma` requires `DIRECT_URL` for Neon (pooled vs direct). Local / single-URL setups
// often only set `DATABASE_URL`; mirroring avoids P1012 when using this wrapper.
if (!process.env.DIRECT_URL?.trim() && process.env.DATABASE_URL?.trim()) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const args = process.argv.slice(2);
const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
