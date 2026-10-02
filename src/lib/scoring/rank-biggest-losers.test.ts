import { describe, expect, it } from "vitest";

import type { StandingsEntry } from "./get-league-standings";
import { rankBiggestLosers } from "./rank-biggest-losers";

function entry(
  overrides: Pick<StandingsEntry, "membershipId" | "displayName" | "losses"> &
    Partial<StandingsEntry>,
): StandingsEntry {
  return {
    imageUrl: null,
    totalPoints: 0,
    wins: 0,
    ties: 0,
    rank: 1,
    ...overrides,
  };
}

describe("rankBiggestLosers", () => {
  it("ranks the user example by valid losses and does not mutate the input", () => {
    const input: StandingsEntry[] = [
      entry({ membershipId: "a", displayName: "A", losses: 1, wins: 0, rank: 1 }),
      entry({ membershipId: "b", displayName: "B", losses: 2, wins: 0, rank: 2 }),
    ];
    const snapshot = input.map((row) => ({ ...row }));

    const result = rankBiggestLosers(input);

    expect(input).toEqual(snapshot);
    expect(result[0]).not.toBe(input[1]);
    expect(result[1]).not.toBe(input[0]);
    expect(result.map((row) => ({ displayName: row.displayName, losses: row.losses, rank: row.rank }))).toEqual([
      { displayName: "B", losses: 2, rank: 1 },
      { displayName: "A", losses: 1, rank: 2 },
    ]);
  });

  it("shares rank when valid losses match, orders names A–Z, and skips the next rank", () => {
    const input = [
      entry({ membershipId: "zoe", displayName: "Zoe", losses: 4 }),
      entry({ membershipId: "chris", displayName: "Chris", losses: 1 }),
      entry({ membershipId: "amy", displayName: "Amy", losses: 4 }),
    ];

    const result = rankBiggestLosers(input);

    expect(result.map((row) => row.displayName)).toEqual(["Amy", "Zoe", "Chris"]);
    expect(result.map((row) => row.rank)).toEqual([1, 1, 3]);
    expect(result.map((row) => row.losses)).toEqual([4, 4, 1]);
  });

  it("sorts a tie game as zero valid losses", () => {
    const input = [
      entry({ membershipId: "tie", displayName: "Tied", losses: 0, ties: 1 }),
      entry({ membershipId: "loss", displayName: "Lost", losses: 1, ties: 0 }),
    ];

    const result = rankBiggestLosers(input);

    expect(result[0]).toMatchObject({ displayName: "Lost", losses: 1, rank: 1 });
    expect(result[1]).toMatchObject({ displayName: "Tied", losses: 0, ties: 1, rank: 2 });
  });
});
