import { randomBytes } from "node:crypto";

import { NflJailedResolutionMethod, Prisma, type PrismaClient } from "@prisma/client";

import { isNflWeekPickWindowClosedByDeadline } from "@/lib/domain/pick-deadline";
import { resolveJailedTeam, type JailedFailure } from "@/lib/domain/jailed";
import { getEffectiveOddsLinesForWeek } from "@/lib/nfl/effective-odds";

const ODDS_LINE_SOURCE_NOTE =
  "Computed from NflGame + effective snapshot lines (Story 3.2/3.3).";

/**
 * Identifies who triggered a jailed compute, recorded on every NFR45 log line so the audit trail
 * can answer "who computed/recomputed this week?" — `via: "automation"` is the bearer-secret path.
 */
export type JailedComputeActor =
  | { via: "admin"; userId: string }
  | { via: "automation"; userId?: undefined };

function spreadToNumber(d: Prisma.Decimal | null): number | null {
  if (d === null) {
    return null;
  }
  return d.toNumber();
}

function toNflJailedMethod(
  r: "MONEYLINE" | "SPREAD" | "RANDOM",
): NflJailedResolutionMethod {
  switch (r) {
    case "MONEYLINE":
      return NflJailedResolutionMethod.MONEYLINE;
    case "SPREAD":
      return NflJailedResolutionMethod.SPREAD;
    case "RANDOM":
      return NflJailedResolutionMethod.RANDOM;
    default: {
      const _x: never = r;
      return _x;
    }
  }
}

export type ComputeJailedDeadlineError = {
  ok: false;
  code: "WEEK_PICK_WINDOW_CLOSED";
  message: string;
  httpStatus: 409;
};

export type ComputeJailedError = (JailedFailure & { httpStatus: number }) | ComputeJailedDeadlineError;

/**
 * Load games + effective odds, resolve jailed (pure), upsert the global `NflWeekJailedTeam` row.
 * **Recompute:** each successful POST overwrites the row; a new `randomSeed` is generated for every run
 * that reaches the random tie-break (MONEYLINE/SPREAD do not use it). Same snapshot inputs + same generated
 * seed is reproducible; **admin re-run** after odds patches replaces the previous result by design and
 * is logged with `actor` + `previous*` fields so the audit trail records every overwrite (NFR45).
 */
export async function computeAndPersistNflWeekJailed(
  prisma: PrismaClient,
  params: { nflSeasonYear: number; weekNumber: number },
  actor: JailedComputeActor,
) {
  const { nflSeasonYear, weekNumber } = params;
  const games = await prisma.nflGame.findMany({
    where: { nflSeasonYear, weekNumber },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      kickoffAt: true,
    },
    orderBy: { kickoffAt: "asc" },
  });

  const gamesForDeadline: { kickoffAt: Date }[] = games
    .filter((g): g is typeof g & { kickoffAt: Date } => g.kickoffAt != null)
    .map((g) => ({ kickoffAt: g.kickoffAt }));

  // Partial schedule: cannot determine the deadline when some games are missing kickoffAt.
  // Refuse recompute rather than silently bypassing the deadline guard.
  if (games.length > 0 && gamesForDeadline.length !== games.length) {
    return {
      ok: false as const,
      error: {
        ok: false,
        code: "NO_GAMES_FOR_WEEK",
        message:
          "Schedule data is incomplete (some games are missing kickoff times); jailed recompute is not allowed until the schedule is fully ingested.",
        httpStatus: 400,
      } satisfies JailedFailure & { httpStatus: number },
    };
  }

  // Capture `now` after the DB round-trip so the check reflects the actual moment of comparison.
  const now = new Date();
  if (
    gamesForDeadline.length > 0 &&
    isNflWeekPickWindowClosedByDeadline({ at: now, games: gamesForDeadline })
  ) {
    return {
      ok: false as const,
      error: {
        ok: false as const,
        code: "WEEK_PICK_WINDOW_CLOSED" as const,
        message:
          "The NFL week pick window has closed; jailed recompute is not allowed after the pick deadline.",
        httpStatus: 409 as const,
      } satisfies ComputeJailedDeadlineError,
    };
  }

  const lineMap = await getEffectiveOddsLinesForWeek(prisma, nflSeasonYear, weekNumber);
  const randomSeed = randomBytes(32).toString("hex");

  const inputs = games.map((g) => {
    const line = lineMap.get(g.id);
    return {
      nflGameId: g.id,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeMoneylineAmerican: line?.homeMoneylineAmerican ?? null,
      awayMoneylineAmerican: line?.awayMoneylineAmerican ?? null,
      homeSpreadPoints: spreadToNumber(line?.homeSpreadPoints ?? null),
    };
  });

  const resolved = resolveJailedTeam(inputs, randomSeed);
  if (!resolved.ok) {
    const status =
      resolved.code === "JAILED_RESOLUTION_INCONSISTENT" ? 500 : 400;
    // NFR45: log with timestamp (added by the runtime), user, and action attempted. 4xx-class
    // codes are validation/state outcomes — `console.warn` so they do not pollute error alerting;
    // 5xx (`JAILED_RESOLUTION_INCONSISTENT`) stays at `console.error`.
    const logFn = status >= 500 ? console.error : console.warn;
    logFn("[jailed] resolution failed", {
      action: "compute_jailed",
      via: actor.via,
      userId: actor.userId ?? null,
      nflSeasonYear,
      weekNumber,
      code: resolved.code,
      message: resolved.message,
    });
    return {
      ok: false as const,
      error: { ...resolved, httpStatus: status } satisfies ComputeJailedError,
    };
  }

  const { result } = resolved;
  const auditJson: Prisma.InputJsonValue = {
    v: 1,
    jailedTeamId: result.jailedTeamId,
    resolvedBy: result.resolvedBy,
    randomSeed: result.randomSeed ?? null,
    ...result.audit,
  };

  // Recompute log (spec: "admin-triggered recompute with explicit log"). Read-then-upsert is not
  // atomic, but this log is best-effort audit — the upsert still wins if the row appears mid-flight.
  const existing = await prisma.nflWeekJailedTeam.findUnique({
    where: {
      nflSeasonYear_weekNumber: { nflSeasonYear, weekNumber },
    },
    select: {
      jailedTeamId: true,
      resolvedBy: true,
      computedAt: true,
    },
  });
  if (existing) {
    console.info("[jailed] recompute", {
      action: "compute_jailed",
      via: actor.via,
      userId: actor.userId ?? null,
      nflSeasonYear,
      weekNumber,
      previousJailedTeamId: existing.jailedTeamId,
      previousResolvedBy: existing.resolvedBy,
      previousComputedAt: existing.computedAt.toISOString(),
      newJailedTeamId: result.jailedTeamId,
      newResolvedBy: result.resolvedBy,
    });
  }

  const row = await prisma.nflWeekJailedTeam.upsert({
    where: {
      nflSeasonYear_weekNumber: { nflSeasonYear, weekNumber },
    },
    create: {
      nflSeasonYear,
      weekNumber,
      jailedTeamId: result.jailedTeamId,
      resolvedBy: toNflJailedMethod(result.resolvedBy),
      randomSeed: result.randomSeed ?? null,
      auditJson,
      oddsLineSourceNote: ODDS_LINE_SOURCE_NOTE,
    },
    update: {
      jailedTeamId: result.jailedTeamId,
      resolvedBy: toNflJailedMethod(result.resolvedBy),
      randomSeed: result.randomSeed ?? null,
      auditJson,
      oddsLineSourceNote: ODDS_LINE_SOURCE_NOTE,
      computedAt: new Date(),
    },
    include: {
      jailedTeam: { select: { id: true, abbreviation: true, name: true } },
    },
  });

  return { ok: true as const, result, row };
}
