import { existsSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Match `scripts/prisma-env.cjs`: Prisma CLI only reads `.env` by default; Next.js uses `.env.local`.
for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) {
    loadEnv({ path: file, override: true });
  }
}

if (!process.env.DIRECT_URL?.trim() && process.env.DATABASE_URL?.trim()) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.cjs",
  },
  datasource: {
    // CLI (migrate, diff, etc.) uses this URL; same role as former `directUrl` (e.g. Neon direct TCP).
    url: env("DIRECT_URL"),
  },
});
