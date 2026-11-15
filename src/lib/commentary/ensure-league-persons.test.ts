import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMembershipFindMany = vi.fn();
const mockPersonCreateMany = vi.fn();
const mockInvitationFindMany = vi.fn();
const mockInvitationCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    leagueMembership: {
      findMany: (...args: unknown[]) => mockMembershipFindMany(...args),
    },
    leaguePerson: {
      createMany: (...args: unknown[]) => mockPersonCreateMany(...args),
    },
    invitation: {
      findMany: (...args: unknown[]) => mockInvitationFindMany(...args),
      create: (...args: unknown[]) => mockInvitationCreate(...args),
    },
  },
}));

import { leaguePlayerMembershipWhere } from "@/lib/league/player-membership-where";

import { ensureLeaguePersons } from "./ensure-league-persons";

describe("ensureLeaguePersons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersonCreateMany.mockResolvedValue({ count: 1 });
  });

  it("links one person when a membership has none, and a second call creates none", async () => {
    mockMembershipFindMany
      .mockResolvedValueOnce([
        { id: "mem-1", leaguePerson: null },
        { id: "mem-2", leaguePerson: { id: "person-2" } },
      ])
      .mockResolvedValueOnce([
        { id: "mem-1", leaguePerson: { id: "person-1" } },
        { id: "mem-2", leaguePerson: { id: "person-2" } },
      ]);

    const first = await ensureLeaguePersons("league-1");
    const second = await ensureLeaguePersons("league-1");

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(mockMembershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: leaguePlayerMembershipWhere("league-1"),
      }),
    );
    expect(mockPersonCreateMany).toHaveBeenCalledOnce();
    expect(mockPersonCreateMany).toHaveBeenCalledWith({
      data: [{ leagueId: "league-1", leagueMembershipId: "mem-1" }],
    });
    expect(mockInvitationFindMany).not.toHaveBeenCalled();
    expect(mockInvitationCreate).not.toHaveBeenCalled();
  });
});
