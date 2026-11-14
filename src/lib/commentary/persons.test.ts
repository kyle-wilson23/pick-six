import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMembershipFindMany = vi.fn();
const mockPersonFindUnique = vi.fn();
const mockPersonCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    leagueMembership: {
      findMany: (...args: unknown[]) => mockMembershipFindMany(...args),
    },
    leaguePerson: {
      findUnique: (...args: unknown[]) => mockPersonFindUnique(...args),
      create: (...args: unknown[]) => mockPersonCreate(...args),
    },
  },
}));

import { leaguePlayerMembershipWhere } from "@/lib/league/player-membership-where";

import { linkLeaguePersons } from "./persons";

describe("linkLeaguePersons", () => {
  const linked = new Set<string>();

  beforeEach(() => {
    vi.clearAllMocks();
    linked.clear();
    mockMembershipFindMany.mockResolvedValue([{ id: "mem-1" }, { id: "mem-2" }]);
    mockPersonFindUnique.mockImplementation(async (args: { where: { membershipId: string } }) => {
      return linked.has(args.where.membershipId) ? { id: `person-${args.where.membershipId}` } : null;
    });
    mockPersonCreate.mockImplementation(async (args: { data: { membershipId: string } }) => {
      linked.add(args.data.membershipId);
      return { id: `person-${args.data.membershipId}` };
    });
  });

  it("creates a person only for a membership that has none", async () => {
    linked.add("mem-1");

    await linkLeaguePersons("lg-1");

    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: leaguePlayerMembershipWhere("lg-1"),
      select: { id: true },
    });
    expect(mockPersonCreate).toHaveBeenCalledTimes(1);
    expect(mockPersonCreate).toHaveBeenCalledWith({
      data: { leagueId: "lg-1", membershipId: "mem-2" },
    });
  });

  it("does not create a second person on a later run", async () => {
    await linkLeaguePersons("lg-1");
    await linkLeaguePersons("lg-1");

    expect(mockPersonCreate).toHaveBeenCalledTimes(2);
    expect(mockPersonCreate.mock.calls.map((call) => call[0].data.membershipId).sort()).toEqual([
      "mem-1",
      "mem-2",
    ]);
  });

  it("treats a unique membership conflict as already linked", async () => {
    mockPersonCreate.mockRejectedValueOnce({ code: "P2002" });

    await expect(linkLeaguePersons("lg-1")).resolves.toBeUndefined();
  });
});
