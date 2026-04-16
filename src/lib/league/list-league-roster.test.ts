import { describe, expect, it } from "vitest";

import { compareLeagueRosterMembers } from "./list-league-roster";

describe("compareLeagueRosterMembers", () => {
  it("sorts by name, then email", () => {
    const a = { user: { name: "Bob", email: "z@x.com" } };
    const b = { user: { name: "Bob", email: "a@x.com" } };
    const c = { user: { name: "Alice", email: "m@x.com" } };
    const sorted = [a, b, c].sort(compareLeagueRosterMembers);
    expect(sorted.map((x) => x.user.email)).toEqual(["m@x.com", "a@x.com", "z@x.com"]);
  });

  it("places null names after non-null names", () => {
    const named = { user: { name: "Zara", email: "z@x.com" } };
    const noname = { user: { name: null, email: "a@x.com" } };
    expect(compareLeagueRosterMembers(named, noname)).toBeLessThan(0);
    expect(compareLeagueRosterMembers(noname, named)).toBeGreaterThan(0);
  });

  it("sorts null-name rows by email", () => {
    const x = { user: { name: null, email: "b@x.com" } };
    const y = { user: { name: null, email: "a@x.com" } };
    expect(compareLeagueRosterMembers(x, y)).toBeGreaterThan(0);
  });
});
