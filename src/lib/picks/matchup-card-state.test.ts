import { describe, expect, it } from "vitest";

import { computeMatchupSideState } from "./matchup-card-state";

const NONE = new Set<string>();

describe("computeMatchupSideState", () => {
  it("default when nothing applies", () => {
    expect(
      computeMatchupSideState({
        teamId: "t1",
        jailedTeamId: null,
        pickedTeamIds: NONE,
        selectedTeamId: null,
        isLocked: false,
      }),
    ).toBe("default");
  });

  it("selected when team is the current pick", () => {
    expect(
      computeMatchupSideState({
        teamId: "t1",
        jailedTeamId: null,
        pickedTeamIds: NONE,
        selectedTeamId: "t1",
        isLocked: false,
      }),
    ).toBe("selected");
  });

  it("jailed wins over selected (jailed cannot be selected, but defensive)", () => {
    expect(
      computeMatchupSideState({
        teamId: "t1",
        jailedTeamId: "t1",
        pickedTeamIds: NONE,
        selectedTeamId: "t1",
        isLocked: false,
      }),
    ).toBe("jailed");
  });

  it("alreadyPicked wins over selected", () => {
    expect(
      computeMatchupSideState({
        teamId: "t1",
        jailedTeamId: null,
        pickedTeamIds: new Set(["t1"]),
        selectedTeamId: "t1",
        isLocked: false,
      }),
    ).toBe("alreadyPicked");
  });

  it("jailed wins over alreadyPicked", () => {
    expect(
      computeMatchupSideState({
        teamId: "t1",
        jailedTeamId: "t1",
        pickedTeamIds: new Set(["t1"]),
        selectedTeamId: null,
        isLocked: false,
      }),
    ).toBe("jailed");
  });

  it("locked overlays default but not selected/jailed/alreadyPicked", () => {
    expect(
      computeMatchupSideState({
        teamId: "t1",
        jailedTeamId: null,
        pickedTeamIds: NONE,
        selectedTeamId: null,
        isLocked: true,
      }),
    ).toBe("locked");

    expect(
      computeMatchupSideState({
        teamId: "selected1",
        jailedTeamId: null,
        pickedTeamIds: NONE,
        selectedTeamId: "selected1",
        isLocked: true,
      }),
    ).toBe("selected");

    expect(
      computeMatchupSideState({
        teamId: "jailed1",
        jailedTeamId: "jailed1",
        pickedTeamIds: NONE,
        selectedTeamId: null,
        isLocked: true,
      }),
    ).toBe("jailed");

    expect(
      computeMatchupSideState({
        teamId: "picked1",
        jailedTeamId: null,
        pickedTeamIds: new Set(["picked1"]),
        selectedTeamId: null,
        isLocked: true,
      }),
    ).toBe("alreadyPicked");
  });

  it("handles a matchup with one jailed side and one default side", () => {
    const ctx = {
      jailedTeamId: "home",
      pickedTeamIds: NONE,
      selectedTeamId: null,
      isLocked: false,
    };
    expect(
      computeMatchupSideState({ teamId: "home", ...ctx }),
    ).toBe("jailed");
    expect(
      computeMatchupSideState({ teamId: "away", ...ctx }),
    ).toBe("default");
  });

  it("handles a matchup with neither side jailed", () => {
    const ctx = {
      jailedTeamId: "elsewhere",
      pickedTeamIds: NONE,
      selectedTeamId: null,
      isLocked: false,
    };
    expect(computeMatchupSideState({ teamId: "home", ...ctx })).toBe("default");
    expect(computeMatchupSideState({ teamId: "away", ...ctx })).toBe("default");
  });
});
