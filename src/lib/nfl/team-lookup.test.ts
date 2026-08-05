import { describe, expect, it } from "vitest";

import { buildTeamLookup } from "./team-lookup";

describe("buildTeamLookup", () => {
  it("indexes by abbreviation and lowercase name", () => {
    const lookup = buildTeamLookup([
      { id: "team-kc", abbreviation: "KC", name: "Kansas City Chiefs" },
      { id: "team-buf", abbreviation: " buf ", name: " Buffalo Bills " },
    ]);

    expect(lookup.byAbbrev.get("KC")).toBe("team-kc");
    expect(lookup.byAbbrev.get("BUF")).toBe("team-buf");
    expect(lookup.byCanonicalNameLower.get("kansas city chiefs")).toBe("team-kc");
    expect(lookup.byCanonicalNameLower.get("buffalo bills")).toBe("team-buf");
  });
});
