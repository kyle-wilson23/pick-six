import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRunFindUnique = vi.fn();
const mockRunCreate = vi.fn();
const mockRunUpdate = vi.fn();
const mockMembershipFindMany = vi.fn();
const mockPersonFindUnique = vi.fn();
const mockPersonCreate = vi.fn();
const mockSeasonFindUnique = vi.fn();
const mockPickFindMany = vi.fn();
const mockGenerateText = vi.fn();
let gatewayApiKey: string | undefined;

vi.mock("@/lib/db", () => ({
  prisma: {
    commentaryRun: {
      findUnique: (...args: unknown[]) => mockRunFindUnique(...args),
      create: (...args: unknown[]) => mockRunCreate(...args),
      update: (...args: unknown[]) => mockRunUpdate(...args),
    },
    leagueMembership: {
      findMany: (...args: unknown[]) => mockMembershipFindMany(...args),
    },
    leaguePerson: {
      findUnique: (...args: unknown[]) => mockPersonFindUnique(...args),
      create: (...args: unknown[]) => mockPersonCreate(...args),
    },
    season: { findUnique: (...args: unknown[]) => mockSeasonFindUnique(...args) },
    pick: { findMany: (...args: unknown[]) => mockPickFindMany(...args) },
  },
}));

vi.mock("ai", () => ({
  createGateway: (settings: { apiKey?: string }) => {
    gatewayApiKey = settings.apiKey;
    return (modelId: string) => ({ modelId });
  },
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  Output: { array: (spec: unknown) => ({ kind: "array", spec }) },
  NoObjectGeneratedError: {
    isInstance: (error: unknown) =>
      Boolean(
        error &&
          typeof error === "object" &&
          (error as { name?: string }).name === "NoObjectGeneratedError",
      ),
  },
}));

import { QUIET_WEEK_SENTENCE } from "./lines";
import { runWeeklyCommentary } from "./runner";

const KEY = { leagueId: "lg-1", nflSeasonYear: 2026, weekNumber: 4 };

const scoredPick = {
  outcome: "WIN" as const,
  pointsEarned: 2,
  nflWeekNumber: 4,
  team: { abbreviation: "PHI" },
  leagueMembership: {
    leaguePerson: { id: "person-1" },
    user: { name: "Alex" },
  },
};

function modelLine(sentence: string) {
  return {
    sentence,
    cells: [
      {
        leaguePersonId: "person-1",
        year: 2026,
        week: 4,
        outcome: "WIN" as const,
        points: 2,
        teamAbbreviation: "PHI",
      },
    ],
  };
}

function stubConfig() {
  vi.stubEnv("COMMENTARY_API_KEY", "test-key");
  vi.stubEnv("COMMENTARY_MODEL_ID", "test/model");
  vi.stubEnv("COMMENTARY_INPUT_USD_PER_MILLION", "3");
  vi.stubEnv("COMMENTARY_OUTPUT_USD_PER_MILLION", "15");
}

function lastUpdate(): { data: Record<string, unknown> } {
  const call = mockRunUpdate.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> } | undefined;
  if (!call) {
    throw new Error("expected a commentary run update");
  }
  return call;
}

describe("runWeeklyCommentary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayApiKey = undefined;
    stubConfig();
    mockRunFindUnique.mockResolvedValue(null);
    mockRunCreate.mockResolvedValue({ id: "run-1", status: "PENDING", outcomeText: null });
    mockRunUpdate.mockResolvedValue({});
    mockMembershipFindMany.mockResolvedValue([{ id: "mem-1" }]);
    mockPersonFindUnique.mockResolvedValue({ id: "person-1" });
    mockSeasonFindUnique.mockResolvedValue({ id: "season-1" });
    mockPickFindMany.mockResolvedValue([scoredPick]);
    mockGenerateText.mockResolvedValue({
      output: [modelLine("Alex won the week.")],
      usage: { inputTokens: 100, outputTokens: 50 },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["PENDING", null, null],
    ["ABNORMAL", "Quiet week. Nothing new for the record book.", null],
    ["SETTLED", "Alex won the week.", "Alex won the week."],
  ] as const)(
    "an existing %s row does not call the model or write",
    async (status, outcomeText, expected) => {
      mockRunFindUnique.mockResolvedValue({ id: "run-1", status, outcomeText });

      const result = await runWeeklyCommentary(KEY);

      expect(result.outcomeText).toBe(expected);
      expect(mockGenerateText).not.toHaveBeenCalled();
      expect(mockRunCreate).not.toHaveBeenCalled();
      expect(mockRunUpdate).not.toHaveBeenCalled();
      expect(mockMembershipFindMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["COMMENTARY_API_KEY", ""],
    ["COMMENTARY_MODEL_ID", "   "],
    ["COMMENTARY_INPUT_USD_PER_MILLION", "nope"],
    ["COMMENTARY_OUTPUT_USD_PER_MILLION", "-2"],
  ] as const)("missing or non-numeric %s does not call or store the quiet line", async (name, value) => {
    vi.stubEnv(name, value);

    const result = await runWeeklyCommentary(KEY);

    expect(result.outcomeText).toBeNull();
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING" }) }),
    );
    expect(lastUpdate().data).toMatchObject({
      status: "ABNORMAL",
      stopReason: "missing_price",
      outcomeText: null,
    });
    expect(JSON.stringify(lastUpdate().data)).not.toContain(QUIET_WEEK_SENTENCE);
  });

  it("stores model_error without the quiet line when the call throws", async () => {
    mockGenerateText.mockRejectedValue(new Error("down"));

    const result = await runWeeklyCommentary(KEY);

    expect(result.outcomeText).toBeNull();
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(lastUpdate().data).toMatchObject({
      status: "ABNORMAL",
      stopReason: "model_error",
      outcomeText: null,
    });
    expect((lastUpdate().data.spend as Prisma.Decimal).equals(new Prisma.Decimal(0))).toBe(true);
    expect(JSON.stringify(lastUpdate().data)).not.toContain(QUIET_WEEK_SENTENCE);
  });

  it("records spend when a thrown call reports usage", async () => {
    const error = new Error("down") as Error & {
      usage: { inputTokens: number; outputTokens: number };
    };
    error.usage = { inputTokens: 100, outputTokens: 50 };
    mockGenerateText.mockRejectedValue(error);

    await runWeeklyCommentary(KEY);

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect((lastUpdate().data.spend as Prisma.Decimal).equals(new Prisma.Decimal("0.00105"))).toBe(
      true,
    );
    expect(lastUpdate().data.outcomeText).toBeNull();
    expect(lastUpdate().data.stopReason).toBe("model_error");
  });

  it("stores model_error when the output is not a Zod list", async () => {
    mockGenerateText.mockResolvedValue({
      output: { nope: true },
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    const result = await runWeeklyCommentary(KEY);

    expect(result.outcomeText).toBeNull();
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(lastUpdate().data).toMatchObject({
      status: "ABNORMAL",
      stopReason: "model_error",
      outcomeText: null,
    });
    expect(JSON.stringify(lastUpdate().data)).not.toContain(QUIET_WEEK_SENTENCE);
  });

  it("inserts pending, calls once, and settles the kept sentence on that row", async () => {
    let picksReadBeforeTheCall = 0;
    mockGenerateText.mockImplementation(async () => {
      picksReadBeforeTheCall = mockPickFindMany.mock.calls.length;
      return {
        output: [modelLine("Alex won the week.")],
        usage: { inputTokens: 100, outputTokens: 50 },
      };
    });

    const result = await runWeeklyCommentary(KEY);

    expect(result.outcomeText).toBe("Alex won the week.");
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(mockMembershipFindMany.mock.invocationCallOrder[0]).toBeLessThan(
      mockRunCreate.mock.invocationCallOrder[0] ?? 0,
    );
    expect(mockRunCreate.mock.invocationCallOrder[0]).toBeLessThan(
      mockGenerateText.mock.invocationCallOrder[0] ?? 0,
    );
    expect(picksReadBeforeTheCall).toBe(1);
    expect(mockPickFindMany).toHaveBeenCalledTimes(2);
    expect(mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({
          status: "SETTLED",
          stopReason: null,
          outcomeText: "Alex won the week.",
        }),
      }),
    );
    expect((lastUpdate().data.spend as Prisma.Decimal).equals(new Prisma.Decimal("0.00105"))).toBe(
      true,
    );
    expect(gatewayApiKey).toBe("test-key");
    const call = mockGenerateText.mock.calls[0]?.[0] as {
      maxRetries: number;
      model: { modelId: string };
      prompt: string;
    };
    expect(call.maxRetries).toBe(0);
    expect(call.model).toEqual({ modelId: "test/model" });
    expect(call.prompt).toContain("person-1");
    expect(call.prompt).not.toContain("test-key");
    expect(call.prompt).not.toContain("password");
    expect(call.prompt).not.toContain("@");
  });

  it("does not call again when the list is short and the spend is under $1", async () => {
    mockGenerateText.mockResolvedValue({
      output: [modelLine("Alex won the week.")],
      usage: { inputTokens: 10, outputTokens: 5 },
    });

    await runWeeklyCommentary(KEY);

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("keeps the first three matching lines and does not backfill a fourth", async () => {
    mockGenerateText.mockResolvedValue({
      output: [
        modelLine("ALL-TIME best."),
        modelLine("Alex won the week."),
        modelLine("Second kept."),
        modelLine("Fourth stays out."),
      ],
      usage: { inputTokens: 10, outputTokens: 5 },
    });

    const dropped = await runWeeklyCommentary(KEY);

    expect(dropped.outcomeText).toBe("Alex won the week.\nSecond kept.");
    expect(dropped.outcomeText).not.toContain("Fourth");
    expect(dropped.outcomeText).not.toContain("ALL-TIME");
    expect(mockGenerateText).toHaveBeenCalledTimes(1);

    mockRunFindUnique.mockResolvedValue(null);
    mockGenerateText.mockResolvedValue({
      output: [
        modelLine("One."),
        modelLine("Two."),
        modelLine("Three."),
        modelLine("Fourth stays out."),
      ],
      usage: { inputTokens: 10, outputTokens: 5 },
    });

    const three = await runWeeklyCommentary(KEY);

    expect(three.outcomeText).toBe("One.\nTwo.\nThree.");
    expect(three.outcomeText).not.toContain("Fourth");
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it("stores the quiet sentence when the fresh read does not match the prompted view", async () => {
    mockPickFindMany
      .mockResolvedValueOnce([scoredPick])
      .mockResolvedValueOnce([{ ...scoredPick, outcome: "LOSS", pointsEarned: 0 }]);

    const result = await runWeeklyCommentary(KEY);

    expect(result.outcomeText).toBe(QUIET_WEEK_SENTENCE);
    expect(lastUpdate().data).toMatchObject({
      status: "SETTLED",
      outcomeText: QUIET_WEEK_SENTENCE,
      lines: [],
    });
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("does not call when a concurrent insert already stored the row", async () => {
    mockRunFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "run-existing",
        status: "SETTLED",
        outcomeText: "Already written.",
      });
    mockRunCreate.mockRejectedValue({ code: "P2002" });

    const result = await runWeeklyCommentary(KEY);

    expect(result.outcomeText).toBe("Already written.");
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockRunUpdate).not.toHaveBeenCalled();
  });
});
