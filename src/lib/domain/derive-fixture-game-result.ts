import { createHash } from "node:crypto";

export type FixtureGameResultInput = {
  nflSeasonYear: number;
  weekNumber: number;
  homeTeamId: string;
  awayTeamId: string;
};

export type FixtureGameResult = {
  homeScore: number;
  awayScore: number;
};

/** Inclusive NFL-plausible score bounds for rehearsal fixtures. */
const SCORE_MIN = 3;
const SCORE_MAX = 45;
/** Inclusive value count in [SCORE_MIN, SCORE_MAX]. */
const SCORE_SPAN = SCORE_MAX - SCORE_MIN + 1;
/** Fixed margin used when independently-derived scores collide (never-tie guarantee). */
const TIE_BREAK_MARGIN = 7;

// Invariant required for the collision bump below to always stay in [SCORE_MIN, SCORE_MAX]:
// whichever side gets bumped, at least one direction (up or down) must remain in range.
if (SCORE_SPAN <= 2 * TIE_BREAK_MARGIN) {
  throw new Error(
    "derive-fixture-game-result: TIE_BREAK_MARGIN too large relative to [SCORE_MIN, SCORE_MAX] range",
  );
}

/**
 * Deterministic fixture game result for rehearsal (Story 8.4). Pure hash of
 * `(nflSeasonYear, weekNumber, homeTeamId, awayTeamId)` with a trailing `:result`
 * suffix so the seed is independent of `deriveFixtureOddsLine`'s hash for the same game.
 *
 * Always returns `homeScore !== awayScore` so the production scoring pipeline can exercise
 * win/loss / anti-jailed-bonus paths (ties are valid production state but not useful here).
 */
export function deriveFixtureGameResult(input: FixtureGameResultInput): FixtureGameResult {
  const seed = `${input.nflSeasonYear}:${input.weekNumber}:${input.homeTeamId}:${input.awayTeamId}:result`;
  const buf = createHash("sha256").update(seed, "utf8").digest();

  let homeScore = SCORE_MIN + (readU16(buf, 0) % SCORE_SPAN);
  let awayScore = SCORE_MIN + (readU16(buf, 2) % SCORE_SPAN);

  if (homeScore === awayScore) {
    const bumpHome = (buf[4]! & 1) === 0;
    if (bumpHome) {
      homeScore =
        homeScore + TIE_BREAK_MARGIN <= SCORE_MAX
          ? homeScore + TIE_BREAK_MARGIN
          : homeScore - TIE_BREAK_MARGIN;
    } else {
      awayScore =
        awayScore + TIE_BREAK_MARGIN <= SCORE_MAX
          ? awayScore + TIE_BREAK_MARGIN
          : awayScore - TIE_BREAK_MARGIN;
    }
  }

  return { homeScore, awayScore };
}

function readU16(buf: Buffer, offset: number): number {
  return buf.readUInt16BE(offset);
}
