import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { normalizePgConnectionString } from "@/lib/normalize-pg-connection-string";

function resolveConnectionString(): string {
  const url = process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();
  if (url) return normalizePgConnectionString(url);
  // Vitest imports modules that reference `prisma` while testing pure helpers; no DB I/O in those suites.
  if (process.env.VITEST) {
    return "postgresql://127.0.0.1:5432/vitest_prisma_placeholder";
  }
  throw new Error("DATABASE_URL is not set");
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: resolveConnectionString() });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
