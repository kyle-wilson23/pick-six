import {
  isNflWeekPickWindowClosedByDeadline,
  PICK_DEADLINE_PASSED_USER_MESSAGE,
} from "@/lib/domain/pick-deadline";

/**
 * **Story 3.5** — server-authoritative pick deadline. Call only after the week’s `NflGame` rows
 * are loaded and **all** have `kickoffAt` (otherwise use `GAMES_NOT_LOADED` in the route, not
 * this helper).
 */
export type PickMutationDeadlineRouteError = {
  status: 403;
  code: "PICK_DEADLINE_PASSED";
  message: string;
};

export function checkPickMutationDeadline(input: {
  now: Date;
  games: { kickoffAt: Date }[];
}): PickMutationDeadlineRouteError | null {
  if (input.games.length === 0) {
    return null;
  }
  if (isNflWeekPickWindowClosedByDeadline({ at: input.now, games: input.games })) {
    return {
      status: 403,
      code: "PICK_DEADLINE_PASSED",
      message: PICK_DEADLINE_PASSED_USER_MESSAGE,
    };
  }
  return null;
}
