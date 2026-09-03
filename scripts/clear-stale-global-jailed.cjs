#!/usr/bin/env node
/**
 * Find / delete leftover pre-hybrid global jailed rows (NflWeekJailedTeam).
 *
 * Does **not** advance any league week. Does **not** touch LeagueWeekJailedTeam
 * (current test-league jailed) or picks.
 *
 * A row is stale when its audit candidate game ids have **zero overlap** with
 * the current live (non-fixture-only) NflGame slate for that (year, week).
 * A Week 1 row you already recomputed against the real slate is kept.
 *
 * Usage (loads .env / .env.local like other db scripts):
 *   node scripts/clear-stale-global-jailed.cjs           # dry-run
 *   node scripts/clear-stale-global-jailed.cjs --apply    # delete stale rows
 *
 * Point DATABASE_URL at production Neon when clearing prod. Dry-run first.
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

const FIXTURE_SOURCE = "test_fixture";
const FIXTURE_ONLY_ODDS_FILTER = {
  oddsLines: {
    some: { oddsSnapshotRun: { source: FIXTURE_SOURCE } },
    none: { oddsSnapshotRun: { source: { not: FIXTURE_SOURCE } } },
  },
};

function applyRequested() {
  return process.argv.includes("--apply");
}

function extractCandidateIds(auditJson) {
  if (typeof auditJson !== "object" || auditJson === null || !Array.isArray(auditJson.candidates)) {
    return [];
  }
  return auditJson.candidates
    .filter((c) => c && typeof c.nflGameId === "string")
    .map((c) => c.nflGameId);
}

function classify(candidateIds, liveIds) {
  const candidates = [...new Set(candidateIds.filter(Boolean))];
  if (candidates.length === 0) {
    return { stale: false };
  }
  if (liveIds.length === 0) {
    return { stale: true, reason: "NO_LIVE_GAMES" };
  }
  const live = new Set(liveIds);
  if (candidates.some((id) => live.has(id))) {
    return { stale: false };
  }
  return { stale: true, reason: "NO_OVERLAP_WITH_LIVE_SLATE" };
}

async function main() {
  const url = process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL (or DIRECT_URL) is required");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
    log: ["error"],
  });

  try {
    const rows = await prisma.nflWeekJailedTeam.findMany({
      select: {
        id: true,
        nflSeasonYear: true,
        weekNumber: true,
        jailedTeamId: true,
        computedAt: true,
        auditJson: true,
        jailedTeam: { select: { abbreviation: true, name: true } },
      },
      orderBy: [{ nflSeasonYear: "asc" }, { weekNumber: "asc" }],
    });

    const stale = [];
    const kept = [];

    for (const row of rows) {
      const liveGames = await prisma.nflGame.findMany({
        where: {
          nflSeasonYear: row.nflSeasonYear,
          weekNumber: row.weekNumber,
          NOT: FIXTURE_ONLY_ODDS_FILTER,
        },
        select: { id: true },
      });
      const candidateGameIds = extractCandidateIds(row.auditJson);
      const liveGameIds = liveGames.map((g) => g.id);
      const verdict = classify(candidateGameIds, liveGameIds);
      const summary = {
        id: row.id,
        nflSeasonYear: row.nflSeasonYear,
        weekNumber: row.weekNumber,
        team: `${row.jailedTeam.name} (${row.jailedTeam.abbreviation})`,
        computedAt: row.computedAt.toISOString(),
        gamesInWeek:
          typeof row.auditJson === "object" &&
          row.auditJson !== null &&
          typeof row.auditJson.gamesInWeek === "number"
            ? row.auditJson.gamesInWeek
            : null,
        auditGames: candidateGameIds.length,
        liveGames: liveGameIds.length,
      };
      if (verdict.stale) {
        stale.push({ ...summary, reason: verdict.reason });
      } else {
        kept.push(summary);
      }
    }

    console.log(
      JSON.stringify(
        {
          databaseHost: (() => {
            try {
              return new URL(url).host;
            } catch {
              return "(unparsed)";
            }
          })(),
          apply: applyRequested(),
          totalJailedRows: rows.length,
          staleCount: stale.length,
          keptCount: kept.length,
          stale,
          kept,
        },
        null,
        2,
      ),
    );

    if (!applyRequested()) {
      console.error(
        `\nDry-run only. ${stale.length} stale row(s) would be deleted. Re-run with --apply to delete.`,
      );
      return;
    }

    if (stale.length === 0) {
      console.error("Nothing to delete.");
      return;
    }

    const result = await prisma.nflWeekJailedTeam.deleteMany({
      where: { id: { in: stale.map((r) => r.id) } },
    });
    console.error(`Deleted ${result.count} stale NflWeekJailedTeam row(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
