import type { NflGameStatus, PrismaClient } from "@prisma/client";

import { scoreNflWeek } from "@/lib/scoring/score-nfl-week";

export type FinalizeNflWeekResult =
  | {
      ok: true;
      allGamesFinalized: boolean;
      finalCount: number;
      notFinalCount: number;
      scored: number;
      skipped: number;
    }
  | { ok: false; code: string; message: string; httpStatus: number };

export function isWeekFullyFinalized(
  games: Array<{ status: NflGameStatus }>,
): boolean {
  return games.every(
    (g) => g.status === "FINAL" || g.status === "CANCELLED",
  );
}

/**
 * Check whether all games for a week are resolved; if so, run weekly pick scoring.
 * Idempotent — re-running with the same data returns the same result.
 */
export async function finalizeNflWeek(
  prisma: PrismaClient,
  opts: { nflSeasonYear: number; weekNumber: number },
): Promise<FinalizeNflWeekResult> {
  try {
    const games = await prisma.nflGame.findMany({
      where: { nflSeasonYear: opts.nflSeasonYear, weekNumber: opts.weekNumber },
      select: { status: true },
    });

    const finalCount = games.filter(
      (g) => g.status === "FINAL" || g.status === "CANCELLED",
    ).length;
    const notFinalCount = games.length - finalCount;

    if (!isWeekFullyFinalized(games)) {
      return {
        ok: true,
        allGamesFinalized: false,
        finalCount,
        notFinalCount,
        scored: 0,
        skipped: 0,
      };
    }

    const result = await scoreNflWeek(prisma, opts);
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        httpStatus: result.httpStatus,
      };
    }

    return {
      ok: true,
      allGamesFinalized: true,
      finalCount,
      notFinalCount: 0,
      scored: result.scored,
      skipped: result.skipped,
    };
  } catch (err) {
    return {
      ok: false,
      code: "FINALIZE_ERROR",
      message: err instanceof Error ? err.message : String(err),
      httpStatus: 500,
    };
  }
}
