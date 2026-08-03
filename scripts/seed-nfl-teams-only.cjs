/**
 * Production-safe: upsert the 32 NFL teams from prisma/data/nfl-teams.json.
 * Does NOT create the local `dev@example.com` user, invites, or week-1 games.
 *
 * Usage (point at the target DB first):
 *   DATABASE_URL="postgresql://…" npm run db:seed:teams
 *   # or: node scripts/seed-nfl-teams-only.cjs
 *
 * Loads `.env` / `.env.local` like other db scripts when DATABASE_URL is unset.
 */
const { config } = require("dotenv");
const fs = require("node:fs");
const path = require("node:path");

for (const file of [".env", ".env.local"]) {
  const p = path.join(process.cwd(), file);
  if (fs.existsSync(p)) {
    config({ path: p, override: true });
  }
}

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

function normalizePgConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");
    if (sslmode === "require" || sslmode === "prefer" || sslmode === "verify-ca") {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
    return connectionString;
  } catch {
    return connectionString;
  }
}

const rawUrl = process.env.DATABASE_URL?.trim();
if (!rawUrl) {
  throw new Error("DATABASE_URL is not set");
}

const connectionString = normalizePgConnectionString(rawUrl);
const host = new URL(connectionString).hostname;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const dataPath = path.join(process.cwd(), "prisma", "data", "nfl-teams.json");
  const teams = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  if (!Array.isArray(teams) || teams.length === 0) {
    throw new Error(`No teams found in ${dataPath}`);
  }

  console.log(`Seeding ${teams.length} NFL teams into host=${host} …`);

  for (const t of teams) {
    await prisma.team.upsert({
      where: { abbreviation: t.abbreviation },
      update: { name: t.name },
      create: { abbreviation: t.abbreviation, name: t.name },
    });
  }

  const count = await prisma.team.count();
  console.log(`Done. Team count now: ${count}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
