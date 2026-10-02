import { describe, expect, it } from "vitest";

import { buildTeamPickAriaLabel } from "./team-pick-aria-label";

describe("buildTeamPickAriaLabel", () => {
  const base = {
    teamName: "Kansas City Chiefs",
    moneylineLabel: "-150",
  };

  it("returns name + moneyline for default state", () => {
    expect(buildTeamPickAriaLabel({ ...base, state: "default" })).toBe(
      "Kansas City Chiefs, moneyline -150",
    );
  });

  it("appends jailed", () => {
    expect(buildTeamPickAriaLabel({ ...base, state: "jailed" })).toBe(
      "Kansas City Chiefs, moneyline -150, jailed",
    );
  });

  it("appends already picked with week when provided", () => {
    expect(
      buildTeamPickAriaLabel({ ...base, state: "alreadyPicked", pickedInWeek: 3 }),
    ).toBe("Kansas City Chiefs, moneyline -150, already picked week 3");
  });

  it("appends already picked without week when unknown", () => {
    expect(buildTeamPickAriaLabel({ ...base, state: "alreadyPicked" })).toBe(
      "Kansas City Chiefs, moneyline -150, already picked",
    );
  });

  it("appends selected", () => {
    expect(buildTeamPickAriaLabel({ ...base, state: "selected" })).toBe(
      "Kansas City Chiefs, moneyline -150, selected",
    );
  });

  it("appends locked", () => {
    expect(buildTeamPickAriaLabel({ ...base, state: "locked" })).toBe(
      "Kansas City Chiefs, moneyline -150, locked",
    );
  });

  it("includes the spread when a line is posted", () => {
    expect(buildTeamPickAriaLabel({ ...base, state: "default", spreadLabel: "-5.5" })).toBe(
      "Kansas City Chiefs, moneyline -150, spread -5.5",
    );
  });

  it("omits the spread when the line is missing", () => {
    expect(buildTeamPickAriaLabel({ ...base, state: "selected", spreadLabel: null })).toBe(
      "Kansas City Chiefs, moneyline -150, selected",
    );
  });
});
