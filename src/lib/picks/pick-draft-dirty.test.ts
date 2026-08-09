import { describe, expect, it } from "vitest";

import { isPickDraftDirty } from "./pick-draft-dirty";

describe("isPickDraftDirty", () => {
  it("is not dirty when there is no draft", () => {
    expect(isPickDraftDirty(null, null)).toBe(false);
    expect(
      isPickDraftDirty(null, { teamId: "buf", antiJailedBonus: false }),
    ).toBe(false);
  });

  it("is dirty for a first pick (draft with no saved)", () => {
    expect(
      isPickDraftDirty({ teamId: "buf", antiJailedBonus: false }, null),
    ).toBe(true);
  });

  it("is not dirty when draft equals saved", () => {
    expect(
      isPickDraftDirty(
        { teamId: "buf", antiJailedBonus: false },
        { teamId: "buf", antiJailedBonus: false },
      ),
    ).toBe(false);
  });

  it("is dirty when team changes", () => {
    expect(
      isPickDraftDirty(
        { teamId: "kc", antiJailedBonus: false },
        { teamId: "buf", antiJailedBonus: false },
      ),
    ).toBe(true);
  });

  it("is dirty when anti-jailed bonus flag changes for the same team", () => {
    expect(
      isPickDraftDirty(
        { teamId: "buf", antiJailedBonus: true },
        { teamId: "buf", antiJailedBonus: false },
      ),
    ).toBe(true);
  });
});
