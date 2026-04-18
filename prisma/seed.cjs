/**
 * Dev-only convenience: upsert a user with a bcrypt password hash.
 * Run after migrations: `npm run db:seed` (loads `.env` / `.env.local` like other db scripts).
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

const crypto = require("node:crypto");

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

/**
 * Mirrors `getCurrentNflSeasonYear()` in `src/lib/league/nfl-season.ts` so seed targets the same
 * deployment season label without compiling TypeScript.
 */
function getNflSeasonYearForSeed(now = new Date()) {
  const raw = process.env.NFL_SEASON_YEAR;
  if (raw !== undefined && raw !== "") {
    const n = Number.parseInt(raw, 10);
    if (Number.isInteger(n) && n >= 2000 && n <= 2100) {
      return n;
    }
  }
  return now.getUTCFullYear();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** Keep in sync with `src/lib/normalize-pg-connection-string.ts`. */
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
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const PLACEHOLDER_SEASON_YEAR = "2000";

/**
 * Seeds all 32 NFL teams (idempotent upsert by `abbreviation`).
 * Week 1 games use `prisma/data/nfl-week1-games.json` with `2000` in ISO strings replaced by
 * `getNflSeasonYearForSeed()` so kickoffs stay in September of the active season year.
 *
 * **Expanding to weeks 2–18:** add rows to a new JSON (or the same file with `weekNumber`),
 * or replace this block with a provider sync in a later story. Keep `nfl_season_year` + `week_number`
 * + team FKs; no API keys required for static JSON.
 */
async function seedNflSchedule() {
  const dataDir = path.join(process.cwd(), "prisma", "data");
  const teams = readJson(path.join(dataDir, "nfl-teams.json"));
  const week1Games = readJson(path.join(dataDir, "nfl-week1-games.json"));
  const nflSeasonYear = getNflSeasonYearForSeed();

  for (const t of teams) {
    await prisma.team.upsert({
      where: { abbreviation: t.abbreviation },
      update: { name: t.name },
      create: { abbreviation: t.abbreviation, name: t.name },
    });
  }
  console.log(`Seeded ${teams.length} NFL teams`);

  const abbrToId = new Map(
    (await prisma.team.findMany({ select: { id: true, abbreviation: true } })).map((row) => [
      row.abbreviation,
      row.id,
    ]),
  );

  await prisma.nflGame.deleteMany({
    where: { nflSeasonYear, weekNumber: 1 },
  });

  for (const g of week1Games) {
    const awayId = abbrToId.get(g.awayAbbreviation);
    const homeId = abbrToId.get(g.homeAbbreviation);
    if (!awayId || !homeId) {
      throw new Error(`Unknown team abbreviation in nfl-week1-games.json: ${g.awayAbbreviation} @ ${g.homeAbbreviation}`);
    }
    const kickoffAt = new Date(g.kickoffUtc.replace(PLACEHOLDER_SEASON_YEAR, String(nflSeasonYear)));
    await prisma.nflGame.create({
      data: {
        nflSeasonYear,
        weekNumber: 1,
        awayTeamId: awayId,
        homeTeamId: homeId,
        kickoffAt,
      },
    });
  }

  console.log(
    `Seeded ${week1Games.length} NFL week 1 games for nfl_season_year=${nflSeasonYear} (UTC kickoffs; display uses America/New_York in later epics)`,
  );
}

async function main() {
  const email = "dev@example.com";
  const password = "devpassword123";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: "Dev User" },
    create: {
      email,
      name: "Dev User",
      passwordHash,
    },
  });

  console.log(`Seeded user: ${email} (password: ${password})`);

  await seedNflSchedule();

  const inviteEmail = "invited@example.com";
  await prisma.invitation.deleteMany({ where: { invitedEmail: inviteEmail } });

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.invitation.create({
    data: {
      tokenHash,
      invitedEmail: inviteEmail.trim().toLowerCase(),
      expiresAt,
    },
  });

  const base = (process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  console.log(`Seeded invitation for ${inviteEmail} (expires ${expiresAt.toISOString()})`);
  console.log(`Invite signup URL: ${base}/signup/${rawToken}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
