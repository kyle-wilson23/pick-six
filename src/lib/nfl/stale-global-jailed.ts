import type { Prisma, PrismaClient } from "@prisma/client";

import { ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } from "@/lib/nfl/apply-simulation-odds-snapshot";

type Db = PrismaClient | Prisma.TransactionClient;

/** Fixture-only leftover games: have test_fixture odds and no live/manual odds. */
const FIXTURE_ONLY_ODDS_FILTER = {
  oddsLines: {
    some: {
      oddsSnapshotRun: { source: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE },
    },
    none: {
      oddsSnapshotRun: { source: { not: ODDS_SNAPSHOT_SOURCE_TEST_FIXTURE } },
    },
  },
} as const;

export type StaleGlobalJailedReason = "NO_OVERLAP_WITH_LIVE_SLATE" | "NO_LIVE_GAMES";

export type StaleGlobalJailedRow = {
  id: string;
  nflSeasonYear: number;
  weekNumber: number;
  jailedTeamId: string;
  computedAt: Date;
  gamesInWeek: number | null;
  candidateGameIds: string[];
  liveGameIds: string[];
  reason: StaleGlobalJailedReason;
};

/**
 * Leftover rehearsal jailed: audit game ids do not appear on the current live (non-fixture) slate.
 * A real recompute against today's NflGame rows overlaps and is kept.
 */
export function isStaleGlobalJailedSlate(input: {
  auditCandidateGameIds: string[];
  liveNonFixtureGameIds: string[];
}): { stale: false } | { stale: true; reason: StaleGlobalJailedReason } {
  const candidates = [...new Set(input.auditCandidateGameIds.filter(Boolean))];
  if (candidates.length === 0) {
    return { stale: false };
  }
  if (input.liveNonFixtureGameIds.length === 0) {
    return { stale: true, reason: "NO_LIVE_GAMES" };
  }
  const live = new Set(input.liveNonFixtureGameIds);
  if (candidates.some((id) => live.has(id))) {
    return { stale: false };
  }
  return { stale: true, reason: "NO_OVERLAP_WITH_LIVE_SLATE" };
}

export function extractAuditCandidateGameIds(auditJson: unknown): string[] {
  if (typeof auditJson !== "object" || auditJson === null || !("candidates" in auditJson)) {
    return [];
  }
  const raw = (auditJson as { candidates: unknown }).candidates;
  if (!Array.isArray(raw)) {
    return [];
  }
  const ids: string[] = [];
  for (const c of raw) {
    if (typeof c === "object" && c !== null && "nflGameId" in c && typeof c.nflGameId === "string") {
      ids.push(c.nflGameId);
    }
  }
  return ids;
}

function auditGamesInWeek(auditJson: unknown): number | null {
  if (typeof auditJson !== "object" || auditJson === null || !("gamesInWeek" in auditJson)) {
    return null;
  }
  const n = (auditJson as { gamesInWeek: unknown }).gamesInWeek;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export async function findStaleGlobalJailedRows(prisma: Db): Promise<StaleGlobalJailedRow[]> {
  const rows = await prisma.nflWeekJailedTeam.findMany({
    select: {
      id: true,
      nflSeasonYear: true,
      weekNumber: true,
      jailedTeamId: true,
      computedAt: true,
      auditJson: true,
    },
    orderBy: [{ nflSeasonYear: "asc" }, { weekNumber: "asc" }],
  });

  const stale: StaleGlobalJailedRow[] = [];
  for (const row of rows) {
    const liveGames = await prisma.nflGame.findMany({
      where: {
        nflSeasonYear: row.nflSeasonYear,
        weekNumber: row.weekNumber,
        NOT: FIXTURE_ONLY_ODDS_FILTER,
      },
      select: { id: true },
    });
    const candidateGameIds = extractAuditCandidateGameIds(row.auditJson);
    const liveGameIds = liveGames.map((g) => g.id);
    const verdict = isStaleGlobalJailedSlate({
      auditCandidateGameIds: candidateGameIds,
      liveNonFixtureGameIds: liveGameIds,
    });
    if (!verdict.stale) {
      continue;
    }
    stale.push({
      id: row.id,
      nflSeasonYear: row.nflSeasonYear,
      weekNumber: row.weekNumber,
      jailedTeamId: row.jailedTeamId,
      computedAt: row.computedAt,
      gamesInWeek: auditGamesInWeek(row.auditJson),
      candidateGameIds,
      liveGameIds,
      reason: verdict.reason,
    });
  }
  return stale;
}

export async function deleteStaleGlobalJailedRows(
  prisma: Db,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }
  const result = await prisma.nflWeekJailedTeam.deleteMany({
    where: { id: { in: ids } },
  });
  return result.count;
}
