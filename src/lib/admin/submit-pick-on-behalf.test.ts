import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSeasonFindUnique = vi.fn();
const mockMembershipFindFirst = vi.fn();
const mockJailedFindUnique = vi.fn();
const mockGameFindMany = vi.fn();
const mockPickCount = vi.fn();
const mockPickFindMany = vi.fn();
const mockPickFindUnique = vi.fn();
const mockPickUpsert = vi.fn();
const mockSeasonUpdateMany = vi.fn();
const mockAuditLogCreate = vi.fn();

function createTx() {
  return {
    season: { findUnique: mockSeasonFindUnique, updateMany: mockSeasonUpdateMany },
    leagueMembership: { findFirst: mockMembershipFindFirst },
    nflWeekJailedTeam: { findUnique: mockJailedFindUnique },
    nflGame: { findMany: mockGameFindMany },
    pick: {
      count: mockPickCount,
      findMany: mockPickFindMany,
      findUnique: mockPickFindUnique,
      upsert: mockPickUpsert,
    },
    auditLogEntry: { create: mockAuditLogCreate },
  };
}

vi.mock("@/lib/league/resolve-current-season", () => ({
  resolveCurrentSeasonForLeague: (...args: unknown[]) => mockSeasonFindUnique(...args),
}));

import { submitPickOnBehalf } from "./submit-pick-on-behalf";

const baseSeason = {
  id: "season-1",
  nflSeasonYear: 2026,
  preSeasonInitializedAt: new Date("2026-08-01T00:00:00.000Z"),
  firstCompetitionWeek: 1,
  firstCompetitionWeekLockedAt: null,
};

const baseGames = [
  {
    homeTeamId: "team-home",
    awayTeamId: "team-away",
    kickoffAt: new Date("2026-09-11T20:00:00.000Z"),
  },
  {
    homeTeamId: "team-jailed",
    awayTeamId: "team-opponent",
    kickoffAt: new Date("2026-09-11T23:00:00.000Z"),
  },
];

const baseArgs = {
  leagueId: "league-1",
  adminMembershipId: "admin-mem",
  targetMembershipId: "target-mem",
  teamId: "team-home",
  nflWeekNumber: 1,
  antiJailedBonus: false,
};

function setupHappyPath() {
  mockSeasonFindUnique.mockResolvedValue(baseSeason);
  mockMembershipFindFirst.mockResolvedValue({ id: "target-mem" });
  mockJailedFindUnique.mockResolvedValue({ jailedTeamId: "team-jailed" });
  mockGameFindMany.mockResolvedValue(baseGames);
  mockPickCount.mockResolvedValue(1);
  mockPickFindMany.mockResolvedValue([]);
  mockPickFindUnique.mockResolvedValue(null);
  mockPickUpsert.mockResolvedValue({
    id: "pick-1",
    teamId: "team-home",
    nflWeekNumber: 1,
    antiJailedBonus: false,
    createdAt: new Date("2026-09-10T12:00:00.000Z"),
    updatedAt: new Date("2026-09-10T12:00:00.000Z"),
  });
}

describe("submitPickOnBehalf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates pick on valid override with no prior pick for week → 201", async () => {
    setupHappyPath();

    const result = await submitPickOnBehalf(createTx() as never, baseArgs);

    expect(result).toMatchObject({
      type: "ok",
      status: 201,
      body: { pick: { teamId: "team-home" } },
    });
    expect(mockPickUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ leagueMembershipId: "target-mem" }),
      }),
    );
    expect(mockAuditLogCreate).toHaveBeenCalledOnce();
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        leagueId: "league-1",
        adminMembershipId: "admin-mem",
        targetMembershipId: "target-mem",
        nflWeekNumber: 1,
        beforeTeamId: null,
        afterTeamId: "team-home",
        beforeAntiJailed: null,
        afterAntiJailed: false,
      },
    });
  });

  it("updates existing pick → 200", async () => {
    setupHappyPath();
    mockPickFindUnique.mockResolvedValue({
      id: "pick-existing",
      teamId: "team-away",
      antiJailedBonus: false,
    });
    mockPickUpsert.mockResolvedValue({
      id: "pick-existing",
      teamId: "team-away",
      nflWeekNumber: 1,
      antiJailedBonus: false,
      createdAt: new Date("2026-09-09T12:00:00.000Z"),
      updatedAt: new Date("2026-09-10T12:00:00.000Z"),
    });

    const result = await submitPickOnBehalf(createTx() as never, {
      ...baseArgs,
      teamId: "team-away",
    });

    expect(result).toMatchObject({ type: "ok", status: 200 });
    expect(mockAuditLogCreate).toHaveBeenCalledOnce();
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        leagueId: "league-1",
        adminMembershipId: "admin-mem",
        targetMembershipId: "target-mem",
        nflWeekNumber: 1,
        beforeTeamId: "team-away",
        afterTeamId: "team-away",
        beforeAntiJailed: false,
        afterAntiJailed: false,
      },
    });
  });

  it("rejects duplicate team from another week → 409 DUPLICATE_TEAM", async () => {
    setupHappyPath();
    mockPickFindMany.mockResolvedValue([{ teamId: "team-home" }]);

    const result = await submitPickOnBehalf(createTx() as never, baseArgs);

    expect(result).toMatchObject({
      type: "err",
      status: 409,
      code: "DUPLICATE_TEAM",
    });
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it("rejects jailed team direct pick → 400 JAILED_TEAM_PICK", async () => {
    setupHappyPath();

    const result = await submitPickOnBehalf(createTx() as never, {
      ...baseArgs,
      teamId: "team-jailed",
    });

    expect(result).toMatchObject({
      type: "err",
      status: 400,
      code: "JAILED_TEAM_PICK",
    });
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it("allows anti-jailed path (opponent of jailed team) → 201", async () => {
    setupHappyPath();

    const result = await submitPickOnBehalf(createTx() as never, {
      ...baseArgs,
      teamId: "team-opponent",
      antiJailedBonus: true,
    });

    expect(result).toMatchObject({ type: "ok", status: 201 });
    expect(mockAuditLogCreate).toHaveBeenCalledOnce();
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        leagueId: "league-1",
        adminMembershipId: "admin-mem",
        targetMembershipId: "target-mem",
        nflWeekNumber: 1,
        beforeTeamId: null,
        afterTeamId: "team-opponent",
        beforeAntiJailed: null,
        afterAntiJailed: true,
      },
    });
  });

  it("succeeds post-deadline (no deadline check)", async () => {
    setupHappyPath();
    const pastDeadlineGames = baseGames.map((g) => ({
      ...g,
      kickoffAt: new Date("2020-01-01T00:00:00.000Z"),
    }));
    mockGameFindMany.mockResolvedValue(pastDeadlineGames);

    const result = await submitPickOnBehalf(createTx() as never, baseArgs);

    expect(result).toMatchObject({ type: "ok", status: 201 });
    expect(mockAuditLogCreate).toHaveBeenCalledOnce();
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        leagueId: "league-1",
        adminMembershipId: "admin-mem",
        targetMembershipId: "target-mem",
        nflWeekNumber: 1,
        beforeTeamId: null,
        afterTeamId: "team-home",
        beforeAntiJailed: null,
        afterAntiJailed: false,
      },
    });
  });

  it("returns 404 when target membership not in league", async () => {
    mockSeasonFindUnique.mockResolvedValue(baseSeason);
    mockMembershipFindFirst.mockResolvedValue(null);

    const result = await submitPickOnBehalf(createTx() as never, baseArgs);

    expect(result).toMatchObject({
      type: "err",
      status: 404,
      code: "MEMBER_NOT_FOUND",
    });
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when week not in competition window", async () => {
    mockSeasonFindUnique.mockResolvedValue({
      ...baseSeason,
      firstCompetitionWeek: 5,
    });

    const result = await submitPickOnBehalf(createTx() as never, {
      ...baseArgs,
      nflWeekNumber: 1,
    });

    expect(result).toMatchObject({
      type: "err",
      status: 400,
      code: "WEEK_NOT_IN_COMPETITION",
    });
  });

  it("locks firstCompetitionWeek on first pick for season", async () => {
    setupHappyPath();
    mockPickCount.mockResolvedValue(0);

    await submitPickOnBehalf(createTx() as never, baseArgs);

    expect(mockSeasonUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "season-1", firstCompetitionWeekLockedAt: null },
      }),
    );
    expect(mockAuditLogCreate).toHaveBeenCalledOnce();
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        leagueId: "league-1",
        adminMembershipId: "admin-mem",
        targetMembershipId: "target-mem",
        nflWeekNumber: 1,
        beforeTeamId: null,
        afterTeamId: "team-home",
        beforeAntiJailed: null,
        afterAntiJailed: false,
      },
    });
  });
});
