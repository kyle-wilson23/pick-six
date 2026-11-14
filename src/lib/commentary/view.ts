import "server-only";

import { prisma } from "@/lib/db";
import type { FreshPickCell } from "@/lib/commentary/lines";

export type CommentaryViewEntry = {
  leaguePersonId: string;
  displayName: string | null;
  year: number;
  week: number;
  outcome: "WIN" | "LOSS" | "TIE";
  points: number;
  teamAbbreviation: string;
};

type ScoredPickRow = {
  outcome: "WIN" | "LOSS" | "TIE" | null;
  pointsEarned: number | null;
  nflWeekNumber: number;
  team: { abbreviation: string };
  leagueMembership: {
    leaguePerson: { id: string } | null;
    user?: { name: string | null };
  };
};

function isOutcome(value: string | null): value is "WIN" | "LOSS" | "TIE" {
  return value === "WIN" || value === "LOSS" || value === "TIE";
}

/** A name the model may say. Emails and blank names are omitted. */
export function publicDisplayName(name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? "";
  if (trimmed === "" || trimmed.includes("@")) {
    return null;
  }
  return trimmed;
}

async function seasonIdFor(leagueId: string, nflSeasonYear: number): Promise<string | null> {
  const season = await prisma.season.findUnique({
    where: { leagueId_nflSeasonYear: { leagueId, nflSeasonYear } },
    select: { id: true },
  });
  return season?.id ?? null;
}

/**
 * This week's scored picks for the model: person, outcome, points, and team.
 * No passwords, sessions, emails, or credentials.
 */
export async function buildCommentaryView(args: {
  leagueId: string;
  nflSeasonYear: number;
  weekNumber: number;
}): Promise<CommentaryViewEntry[]> {
  const seasonId = await seasonIdFor(args.leagueId, args.nflSeasonYear);
  if (seasonId == null) {
    return [];
  }

  const picks = await prisma.pick.findMany({
    where: {
      seasonId,
      nflWeekNumber: args.weekNumber,
      outcome: { not: null },
      pointsEarned: { not: null },
    },
    orderBy: { leagueMembershipId: "asc" },
    select: {
      outcome: true,
      pointsEarned: true,
      nflWeekNumber: true,
      team: { select: { abbreviation: true } },
      leagueMembership: {
        select: {
          leaguePerson: { select: { id: true } },
          user: { select: { name: true } },
        },
      },
    },
  });

  return mapViewEntries(picks, args.nflSeasonYear);
}

/**
 * Re-read this week's scored picks from `Pick`. The checker uses this, not the object sent to the model.
 */
export async function loadFreshPickCells(args: {
  leagueId: string;
  nflSeasonYear: number;
  weekNumber: number;
}): Promise<FreshPickCell[]> {
  const seasonId = await seasonIdFor(args.leagueId, args.nflSeasonYear);
  if (seasonId == null) {
    return [];
  }

  const picks = await prisma.pick.findMany({
    where: {
      seasonId,
      nflWeekNumber: args.weekNumber,
      outcome: { not: null },
      pointsEarned: { not: null },
    },
    orderBy: { leagueMembershipId: "asc" },
    select: {
      outcome: true,
      pointsEarned: true,
      nflWeekNumber: true,
      team: { select: { abbreviation: true } },
      leagueMembership: {
        select: {
          leaguePerson: { select: { id: true } },
        },
      },
    },
  });

  return mapFreshCells(picks, args.nflSeasonYear);
}

function mapViewEntries(picks: ScoredPickRow[], nflSeasonYear: number): CommentaryViewEntry[] {
  const entries: CommentaryViewEntry[] = [];
  for (const pick of picks) {
    const cell = toFreshCell(pick, nflSeasonYear);
    if (!cell) continue;
    entries.push({
      ...cell,
      displayName: publicDisplayName(pick.leagueMembership.user?.name),
    });
  }
  return entries;
}

function mapFreshCells(picks: ScoredPickRow[], nflSeasonYear: number): FreshPickCell[] {
  const cells: FreshPickCell[] = [];
  for (const pick of picks) {
    const cell = toFreshCell(pick, nflSeasonYear);
    if (cell) cells.push(cell);
  }
  return cells;
}

function toFreshCell(pick: ScoredPickRow, nflSeasonYear: number): FreshPickCell | null {
  const leaguePersonId = pick.leagueMembership.leaguePerson?.id;
  if (leaguePersonId == null || pick.pointsEarned == null || !isOutcome(pick.outcome)) {
    return null;
  }
  return {
    leaguePersonId,
    year: nflSeasonYear,
    week: pick.nflWeekNumber,
    outcome: pick.outcome,
    points: pick.pointsEarned,
    teamAbbreviation: pick.team.abbreviation,
  };
}
