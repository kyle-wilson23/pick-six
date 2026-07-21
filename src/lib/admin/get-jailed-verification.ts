import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import type { JailedCandidateAudit } from "@/lib/domain/jailed";
import { prisma as prismaSingleton } from "@/lib/db";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import {
  resolveActiveWeekNumber,
  type MinimalNflGameForPicksWeek,
  type MinimalSeasonForPicksWeek,
} from "@/lib/nfl/resolve-picks-week";

const JailedCandidateAuditSchema = z.object({
  nflGameId: z.string(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  homeMoneylineAmerican: z.number(),
  awayMoneylineAmerican: z.number(),
  homeSpreadPoints: z.number(),
  favoriteTeamId: z.string(),
  favoriteMoneylineAmerican: z.number(),
  spreadInFavoriteFavor: z.number(),
});

export const AuditJsonV1Schema = z
  .object({
    v: z.literal(1),
    jailedTeamId: z.string(),
    resolvedBy: z.enum(["MONEYLINE", "SPREAD", "RANDOM"]),
    randomSeed: z.string().nullable(),
    gamesInWeek: z.number(),
    gamesWithCompleteLines: z.number(),
    winningMoneylineAmerican: z.number(),
    tieLevel: z.enum(["MONEYLINE", "SPREAD", "RANDOM"]),
    candidates: z.array(JailedCandidateAuditSchema),
    afterMoneyline: z.array(JailedCandidateAuditSchema).optional(),
    afterSpread: z.array(JailedCandidateAuditSchema).optional(),
  })
  .passthrough();

export type JailedCandidateView = {
  nflGameId: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homeMoneylineAmerican: number;
  awayMoneylineAmerican: number;
  homeSpreadPoints: number;
  favoriteTeamId: string;
  favoriteTeamName: string;
  favoriteMoneylineAmerican: number;
  spreadInFavoriteFavor: number;
};

export type JailedVerificationView = {
  weekNumber: number;
  jailedTeamId: string;
  jailedTeamName: string;
  resolvedBy: "MONEYLINE" | "SPREAD" | "RANDOM";
  randomSeed: string | null;
  gamesInWeek: number;
  gamesWithCompleteLines: number;
  winningMoneylineAmerican: number;
  computedAt: string;
  candidates: JailedCandidateView[];
  afterMoneyline: JailedCandidateView[] | null;
  afterSpread: JailedCandidateView[] | null;
};

function collectTeamIds(audit: {
  candidates: JailedCandidateAudit[];
  afterMoneyline?: JailedCandidateAudit[];
  afterSpread?: JailedCandidateAudit[];
}): string[] {
  const ids = new Set<string>();
  for (const list of [
    audit.candidates,
    audit.afterMoneyline ?? [],
    audit.afterSpread ?? [],
  ]) {
    for (const c of list) {
      ids.add(c.homeTeamId);
      ids.add(c.awayTeamId);
      ids.add(c.favoriteTeamId);
    }
  }
  return [...ids];
}

function toCandidateView(
  c: JailedCandidateAudit,
  teamNameMap: Map<string, string>,
): JailedCandidateView {
  return {
    nflGameId: c.nflGameId,
    homeTeamId: c.homeTeamId,
    homeTeamName: teamNameMap.get(c.homeTeamId) ?? c.homeTeamId,
    awayTeamId: c.awayTeamId,
    awayTeamName: teamNameMap.get(c.awayTeamId) ?? c.awayTeamId,
    homeMoneylineAmerican: c.homeMoneylineAmerican,
    awayMoneylineAmerican: c.awayMoneylineAmerican,
    homeSpreadPoints: c.homeSpreadPoints,
    favoriteTeamId: c.favoriteTeamId,
    favoriteTeamName: teamNameMap.get(c.favoriteTeamId) ?? c.favoriteTeamId,
    favoriteMoneylineAmerican: c.favoriteMoneylineAmerican,
    spreadInFavoriteFavor: c.spreadInFavoriteFavor,
  };
}

function mapSlice(
  slice: JailedCandidateAudit[] | undefined,
  teamNameMap: Map<string, string>,
): JailedCandidateView[] | null {
  if (slice === undefined) {
    return null;
  }
  return slice.map((c) => toCandidateView(c, teamNameMap));
}

function canResolveActiveWeek(args: {
  season: { preSeasonInitializedAt: Date | null; simulatedCurrentWeek?: number | null } | null;
  gamesWithKickoff: MinimalNflGameForPicksWeek[];
  isTestLeague: boolean;
}): boolean {
  const { season, gamesWithKickoff, isTestLeague } = args;
  if (!season || season.preSeasonInitializedAt == null) {
    return false;
  }
  // Test leagues use the simulation clock even when no NflGame rows exist yet (Story 8.2 / 8.3).
  if (isTestLeague && season.simulatedCurrentWeek != null) {
    return true;
  }
  return gamesWithKickoff.length > 0;
}

export async function getJailedVerification(
  args: { leagueId: string },
  db: PrismaClient = prismaSingleton,
  now: Date = new Date(),
): Promise<JailedVerificationView | null> {
  const { leagueId } = args;

  const [season, leagueRow] = await Promise.all([
    resolveCurrentSeasonForLeague(db.season, leagueId),
    db.league.findUnique({
      where: { id: leagueId },
      select: { isTestLeague: true },
    }),
  ]);

  if (!season || season.preSeasonInitializedAt == null) {
    return null;
  }

  const isTestLeague = leagueRow?.isTestLeague ?? false;

  const minimalGames = await db.nflGame.findMany({
    where: { nflSeasonYear: season.nflSeasonYear },
    select: { weekNumber: true, kickoffAt: true },
  });

  const gamesForResolve: MinimalNflGameForPicksWeek[] = minimalGames
    .filter((g): g is { weekNumber: number; kickoffAt: Date } => g.kickoffAt != null)
    .map((g) => ({ weekNumber: g.weekNumber, kickoffAt: g.kickoffAt }));

  if (!canResolveActiveWeek({ season, gamesWithKickoff: gamesForResolve, isTestLeague })) {
    return null;
  }

  const seasonForResolve: MinimalSeasonForPicksWeek = {
    preSeasonInitializedAt: season.preSeasonInitializedAt,
    firstCompetitionWeek: season.firstCompetitionWeek,
    simulatedCurrentWeek: season.simulatedCurrentWeek,
  };

  const weekNumber = resolveActiveWeekNumber({
    isTestLeague,
    season: seasonForResolve,
    gamesForYear: gamesForResolve,
    now,
  });

  const jailed = await db.nflWeekJailedTeam.findUnique({
    where: {
      nflSeasonYear_weekNumber: {
        nflSeasonYear: season.nflSeasonYear,
        weekNumber,
      },
    },
    include: { jailedTeam: { select: { id: true, name: true } } },
  });

  if (!jailed) {
    return null;
  }

  const parsed = AuditJsonV1Schema.safeParse(jailed.auditJson);
  if (!parsed.success) {
    throw new Error(
      `[jailed-verification] auditJson schema validation failed for league=${leagueId} week=${weekNumber}: ${parsed.error.message}`,
    );
  }

  const audit = parsed.data;
  const teamIds = collectTeamIds(audit);
  const teams = await db.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, name: true },
  });
  const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));

  return {
    weekNumber,
    jailedTeamId: jailed.jailedTeamId,
    jailedTeamName: jailed.jailedTeam.name,
    resolvedBy: audit.resolvedBy,
    randomSeed: jailed.randomSeed,
    gamesInWeek: audit.gamesInWeek,
    gamesWithCompleteLines: audit.gamesWithCompleteLines,
    winningMoneylineAmerican: audit.winningMoneylineAmerican,
    computedAt: jailed.computedAt.toISOString(),
    candidates: audit.candidates.map((c) => toCandidateView(c, teamNameMap)),
    afterMoneyline: mapSlice(audit.afterMoneyline, teamNameMap),
    afterSpread: mapSlice(audit.afterSpread, teamNameMap),
  };
}
