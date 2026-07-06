import { describe, expect, it } from "vitest";

import type { LeagueExportData } from "./build-league-export-data";
import { serializeLeagueExportCsv } from "./serialize-league-export-csv";

function makeExportData(overrides: Partial<LeagueExportData> = {}): LeagueExportData {
  return {
    nflSeasonYear: 2026,
    exportedAtIso: "2026-07-06T00:00:00.000Z",
    participants: [],
    jailedByWeek: Array.from({ length: 18 }, (_, index) => ({
      weekNumber: index + 1,
      exportTeamLabel: "",
    })),
    ...overrides,
  };
}

describe("serializeLeagueExportCsv", () => {
  it("escapes RFC 4180 fields containing commas", () => {
    const csv = serializeLeagueExportCsv(
      makeExportData({
        participants: [
          {
            membershipId: "mem-a",
            email: "alice,admin@example.com",
            picksByWeek: new Map(),
            totalPoints: 0,
          },
        ],
      }),
    );

    expect(csv.split("\n")[2]).toBe('"alice,admin@example.com",,,,,,,,,,,,,,,,,,,0');
  });

  it("emits two header rows with week columns and jailed labels", () => {
    const csv = serializeLeagueExportCsv(
      makeExportData({
        jailedByWeek: Array.from({ length: 18 }, (_, index) => ({
          weekNumber: index + 1,
          exportTeamLabel: index === 0 ? "Broncos" : index === 1 ? "Ravens" : "",
        })),
      }),
    );

    const [row1, row2] = csv.split("\n");
    expect(row1).toBe(
      "Email,Week 1,Week 2,Week 3,Week 4,Week 5,Week 6,Week 7,Week 8,Week 9,Week 10,Week 11,Week 12,Week 13,Week 14,Week 15,Week 16,Week 17,Week 18,Total Points",
    );
    expect(row2).toBe(
      ",Broncos,Ravens,,,,,,,,,,,,,,,,,",
    );
  });

  it("renders participant email, week pick labels, and trailing total points", () => {
    const picksByWeek = new Map([
      [
        1,
        {
          exportTeamLabel: "Commanders",
          antiJailedBonus: false,
          outcome: "WIN" as const,
          pointsEarned: 1,
        },
      ],
      [
        2,
        {
          exportTeamLabel: "Cardinals",
          antiJailedBonus: false,
          outcome: "PENDING" as const,
          pointsEarned: null,
        },
      ],
    ]);

    const csv = serializeLeagueExportCsv(
      makeExportData({
        participants: [
          {
            membershipId: "mem-a",
            email: "player@example.com",
            picksByWeek,
            totalPoints: 1,
          },
        ],
      }),
    );

    expect(csv.split("\n")[2]).toBe(
      "player@example.com,Commanders,Cardinals,,,,,,,,,,,,,,,,,1",
    );
  });

  it("renders empty cells for missing week picks", () => {
    const csv = serializeLeagueExportCsv(
      makeExportData({
        participants: [
          {
            membershipId: "mem-a",
            email: "player@example.com",
            picksByWeek: new Map([
              [
                3,
                {
                  exportTeamLabel: "Broncos",
                  antiJailedBonus: false,
                  outcome: "WIN",
                  pointsEarned: 1,
                },
              ],
            ]),
            totalPoints: 1,
          },
        ],
      }),
    );

    const row = csv.split("\n")[2]?.split(",");
    expect(row?.[0]).toBe("player@example.com");
    expect(row?.[1]).toBe("");
    expect(row?.[2]).toBe("");
    expect(row?.[3]).toBe("Broncos");
    expect(row?.[19]).toBe("1");
  });
});
