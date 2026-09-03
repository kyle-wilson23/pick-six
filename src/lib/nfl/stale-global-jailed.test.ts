import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import {
  extractAuditCandidateGameIds,
  findStaleGlobalJailedRows,
  isStaleGlobalJailedSlate,
} from "./stale-global-jailed";

describe("isStaleGlobalJailedSlate", () => {
  it("keeps a row whose audit games appear on the live slate", () => {
    expect(
      isStaleGlobalJailedSlate({
        auditCandidateGameIds: ["live-1", "live-2"],
        liveNonFixtureGameIds: ["live-1", "live-2", "live-3"],
      }),
    ).toEqual({ stale: false });
  });

  it("flags leftover fixture audits that share no ids with the live slate", () => {
    expect(
      isStaleGlobalJailedSlate({
        auditCandidateGameIds: ["fixture-kc-buf", "fixture-phi-dal"],
        liveNonFixtureGameIds: ["hou-buf", "lac-ari"],
      }),
    ).toEqual({ stale: true, reason: "NO_OVERLAP_WITH_LIVE_SLATE" });
  });

  it("flags leftover audits when the week has no live (non-fixture) games", () => {
    expect(
      isStaleGlobalJailedSlate({
        auditCandidateGameIds: ["fixture-1"],
        liveNonFixtureGameIds: [],
      }),
    ).toEqual({ stale: true, reason: "NO_LIVE_GAMES" });
  });

  it("does not flag empty or unreadable audits", () => {
    expect(
      isStaleGlobalJailedSlate({
        auditCandidateGameIds: [],
        liveNonFixtureGameIds: ["live-1"],
      }),
    ).toEqual({ stale: false });
  });
});

describe("extractAuditCandidateGameIds", () => {
  it("reads nflGameId from audit candidates", () => {
    expect(
      extractAuditCandidateGameIds({
        v: 1,
        candidates: [{ nflGameId: "g1" }, { nflGameId: "g2" }, { other: true }],
      }),
    ).toEqual(["g1", "g2"]);
  });

  it("returns empty for malformed audit", () => {
    expect(extractAuditCandidateGameIds(null)).toEqual([]);
    expect(extractAuditCandidateGameIds({ candidates: "nope" })).toEqual([]);
  });
});

describe("findStaleGlobalJailedRows", () => {
  it("returns only weeks whose audit games miss the live slate", async () => {
    const prisma = {
      nflWeekJailedTeam: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "keep-w1",
            nflSeasonYear: 2026,
            weekNumber: 1,
            jailedTeamId: "lac",
            computedAt: new Date("2026-09-03T12:00:00Z"),
            auditJson: { gamesInWeek: 16, candidates: [{ nflGameId: "live-w1-a" }] },
          },
          {
            id: "stale-w2",
            nflSeasonYear: 2026,
            weekNumber: 2,
            jailedTeamId: "buf",
            computedAt: new Date("2026-08-03T23:51:59Z"),
            auditJson: { gamesInWeek: 4, candidates: [{ nflGameId: "fixture-kc-buf" }] },
          },
        ]),
      },
      nflGame: {
        findMany: vi.fn().mockImplementation(({ where }: { where: { weekNumber: number } }) => {
          if (where.weekNumber === 1) {
            return Promise.resolve([{ id: "live-w1-a" }, { id: "live-w1-b" }]);
          }
          return Promise.resolve([{ id: "live-w2-a" }]);
        }),
      },
    } as unknown as PrismaClient;

    const stale = await findStaleGlobalJailedRows(prisma);
    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatchObject({
      id: "stale-w2",
      weekNumber: 2,
      reason: "NO_OVERLAP_WITH_LIVE_SLATE",
      gamesInWeek: 4,
    });
  });
});
