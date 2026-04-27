import { describe, expect, it } from "vitest";

import { PICK_DEADLINE_PASSED_USER_MESSAGE } from "@/lib/domain/pick-deadline";

import { checkPickMutationDeadline } from "./assert-pick-mutation-allowed";

describe("checkPickMutationDeadline", () => {
  it("returns null when the pick window is open (kickoff far in the future)", () => {
    // Deadline = min(kickoff − 5m, Thursday 8:10 PM). With kickoff in 2099, both legs are future.
    const farFutureKickoff = new Date("2099-10-10T20:20:00.000Z");
    const result = checkPickMutationDeadline({
      now: new Date(),
      games: [{ kickoffAt: farFutureKickoff }],
    });
    expect(result).toBeNull();
  });

  it("returns 403 PICK_DEADLINE_PASSED with correct shape when window is closed", () => {
    // Kickoff far in the past: both deadline legs are well before now.
    const farPastKickoff = new Date("2000-10-10T20:20:00.000Z");
    const result = checkPickMutationDeadline({
      now: new Date(),
      games: [{ kickoffAt: farPastKickoff }],
    });
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
    expect(result?.code).toBe("PICK_DEADLINE_PASSED");
    expect(result?.message).toBe(PICK_DEADLINE_PASSED_USER_MESSAGE);
  });

  it("returns null for empty games array (precondition: route handles GAMES_NOT_LOADED first)", () => {
    expect(checkPickMutationDeadline({ now: new Date(), games: [] })).toBeNull();
  });
});
