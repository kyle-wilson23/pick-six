import "server-only";

import type { PrismaClient } from "@prisma/client";

import { resolveWeekCloseTargets, type WeekCloseTargets } from "@/lib/cron/week-close-targets";
import { computeAndPersistNflWeekJailed } from "@/lib/nfl/jailed-computation";
import { snapshotNflWeekOddsFromProvider } from "@/lib/nfl/snapshot-nfl-week-odds";
import { syncNflResultsFromOdds } from "@/lib/nfl/sync-nfl-results-from-odds";
import { finalizeNflWeek, type FinalizeNflWeekResult } from "@/lib/scoring/finalize-nfl-week";

export type WeekCloseStepSkipped = {
  skipped: true;
  reason: "no_closed_week" | "no_opening_week" | "results_failed" | "snapshot_failed";
};

export type WeekCloseHardFailure = {
  ok: false;
  code: string;
  message: string;
  httpStatus: number;
};

export type WeekCloseResultsStep =
  | { ok: true; synced: number; skipped: number }
  | WeekCloseHardFailure;

export type WeekCloseFinalizeStep =
  | ({ ok: true } & Extract<FinalizeNflWeekResult, { ok: true }>)
  | WeekCloseStepSkipped
  | WeekCloseHardFailure;

export type WeekCloseSnapshotStep =
  | { ok: true; runId: string; matchedGames: number; totalGamesInWeek: number }
  | WeekCloseStepSkipped
  | WeekCloseHardFailure;

export type WeekCloseJailedStep =
  | { ok: true; jailedTeamId: string }
  | WeekCloseStepSkipped
  | WeekCloseHardFailure;

export type RunWeekCloseResult = WeekCloseTargets & {
  ok: boolean;
  httpStatus: number;
  nflSeasonYear: number;
  results: WeekCloseResultsStep;
  finalize: WeekCloseFinalizeStep;
  snapshot: WeekCloseSnapshotStep;
  jailed: WeekCloseJailedStep;
};

function firstHardStatus(
  ...steps: Array<WeekCloseResultsStep | WeekCloseFinalizeStep | WeekCloseSnapshotStep | WeekCloseJailedStep>
): number {
  for (const step of steps) {
    if ("ok" in step && step.ok === false && typeof step.httpStatus === "number") {
      return step.httpStatus;
    }
  }
  return 200;
}

export async function loadWeekCloseTargets(
  prisma: PrismaClient,
  nflSeasonYear: number,
  now: Date = new Date(),
): Promise<WeekCloseTargets> {
  const games = await prisma.nflGame.findMany({
    where: { nflSeasonYear },
    select: { weekNumber: true, kickoffAt: true },
  });
  return resolveWeekCloseTargets(games, now);
}

export async function finalizeClosedWeekAfterResultsSync(
  prisma: PrismaClient,
  nflSeasonYear: number,
  now: Date = new Date(),
): Promise<{ closedWeek: number | null; finalize: WeekCloseFinalizeStep }> {
  const { closedWeek } = await loadWeekCloseTargets(prisma, nflSeasonYear, now);
  if (closedWeek == null) {
    return { closedWeek: null, finalize: { skipped: true, reason: "no_closed_week" } };
  }
  const result = await finalizeNflWeek(prisma, { nflSeasonYear, weekNumber: closedWeek });
  if (!result.ok) {
    return {
      closedWeek,
      finalize: {
        ok: false,
        code: result.code,
        message: result.message,
        httpStatus: result.httpStatus,
      },
    };
  }
  return { closedWeek, finalize: result };
}

export async function runWeekClose(
  prisma: PrismaClient,
  opts: { apiKey: string; nflSeasonYear: number; now?: Date },
): Promise<RunWeekCloseResult> {
  const now = opts.now ?? new Date();
  const { nflSeasonYear, apiKey } = opts;
  const targets = await loadWeekCloseTargets(prisma, nflSeasonYear, now);

  const resultsSync = await syncNflResultsFromOdds(prisma, { apiKey, nflSeasonYear });
  const results: WeekCloseResultsStep = resultsSync.ok
    ? { ok: true, synced: resultsSync.synced, skipped: resultsSync.skipped }
    : {
        ok: false,
        code: resultsSync.code,
        message: resultsSync.message,
        httpStatus: resultsSync.httpStatus,
      };

  let finalize: WeekCloseFinalizeStep;
  if (!results.ok) {
    finalize = { skipped: true, reason: "results_failed" };
  } else if (targets.closedWeek == null) {
    finalize = { skipped: true, reason: "no_closed_week" };
  } else {
    const finalized = await finalizeNflWeek(prisma, {
      nflSeasonYear,
      weekNumber: targets.closedWeek,
    });
    finalize = finalized.ok
      ? finalized
      : {
          ok: false,
          code: finalized.code,
          message: finalized.message,
          httpStatus: finalized.httpStatus,
        };
  }

  let snapshot: WeekCloseSnapshotStep;
  let jailed: WeekCloseJailedStep;

  if (targets.snapshotWeek == null) {
    snapshot = { skipped: true, reason: "no_opening_week" };
    jailed = { skipped: true, reason: "no_opening_week" };
  } else {
    const snap = await snapshotNflWeekOddsFromProvider(prisma, {
      nflSeasonYear,
      weekNumber: targets.snapshotWeek,
      apiKey,
    });
    if (!snap.ok) {
      snapshot = {
        ok: false,
        code: snap.code,
        message: snap.message,
        httpStatus: snap.httpStatus,
      };
      jailed = { skipped: true, reason: "snapshot_failed" };
    } else {
      snapshot = {
        ok: true,
        runId: snap.runId,
        matchedGames: snap.matchedGames,
        totalGamesInWeek: snap.totalGamesInWeek,
      };
      const jailedOut = await computeAndPersistNflWeekJailed(
        prisma,
        { nflSeasonYear, weekNumber: targets.snapshotWeek },
        { via: "automation" },
      );
      if (!jailedOut.ok) {
        jailed = {
          ok: false,
          code: jailedOut.error.code,
          message: jailedOut.error.message,
          httpStatus: jailedOut.error.httpStatus,
        };
      } else {
        jailed = { ok: true, jailedTeamId: jailedOut.result.jailedTeamId };
      }
    }
  }

  const httpStatus = firstHardStatus(results, finalize, snapshot, jailed);
  return {
    ok: httpStatus < 400,
    httpStatus,
    nflSeasonYear,
    ...targets,
    results,
    finalize,
    snapshot,
    jailed,
  };
}

export function firstHardFailure(
  result: Pick<RunWeekCloseResult, "results" | "finalize" | "snapshot" | "jailed">,
): WeekCloseHardFailure | null {
  for (const step of [result.results, result.finalize, result.snapshot, result.jailed]) {
    if ("ok" in step && step.ok === false) {
      return step;
    }
  }
  return null;
}
