import { CommentaryRunStatus, Prisma } from "@prisma/client";
import { Output } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commentaryLineListSchema, type CommentaryLine } from "./line-schema";
import { QUIET_WEEK_SENTENCE } from "./quiet-week";
import type { CommentaryWeekViewRow } from "./week-view";

type StoredRun = {
  id: string;
  leagueId: string;
  nflSeasonYear: number;
  weekNumber: number;
  status: CommentaryRunStatus;
  stopReason: string | null;
  spendUsd: Prisma.Decimal;
  sentences: string[];
};

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  ensureLeaguePersons: vi.fn(),
  loadCommentaryWeekView: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: (...args: unknown[]) => mocks.generateText(...args),
  };
});

vi.mock("./ensure-league-persons", () => ({
  ensureLeaguePersons: (...args: unknown[]) => mocks.ensureLeaguePersons(...args),
}));

vi.mock("./week-view", () => ({
  loadCommentaryWeekView: (...args: unknown[]) => mocks.loadCommentaryWeekView(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    commentaryRun: {
      findUnique: (...args: unknown[]) => mocks.findUnique(...args),
      create: (...args: unknown[]) => mocks.create(...args),
      update: (...args: unknown[]) => mocks.update(...args),
    },
  },
}));

import { runCommentary } from "./run-commentary";

const LEAGUE_ID = "league-1";
const YEAR = 2026;
const WEEK = 4;

const view: CommentaryWeekViewRow[] = [
  {
    personId: "person-1",
    userDisplayName: "Alice",
    outcome: "WIN",
    points: 2,
    teamAbbreviation: "BUF",
  },
  {
    personId: "person-2",
    userDisplayName: "Bob",
    outcome: "LOSS",
    points: 0,
    teamAbbreviation: "NYJ",
  },
  {
    personId: "person-3",
    userDisplayName: "Cara",
    outcome: "TIE",
    points: 0,
    teamAbbreviation: "PHI",
  },
];

const CALLABLE_ENV = {
  COMMENTARY_MODEL_ID: "test/model",
  AI_GATEWAY_API_KEY: "test-key",
  COMMENTARY_INPUT_USD_PER_MILLION: "1",
  COMMENTARY_OUTPUT_USD_PER_MILLION: "2",
};

function line(person: CommentaryWeekViewRow, sentence: string): CommentaryLine {
  return {
    sentence,
    personId: person.personId,
    year: YEAR,
    week: WEEK,
    outcome: person.outcome,
    points: person.points,
    team: person.teamAbbreviation,
  };
}

function modelResult(
  lines: CommentaryLine[],
  inputTokens: number,
  outputTokens = 0,
) {
  return {
    output: { lines },
    totalUsage: { inputTokens, outputTokens },
  };
}

describe("runCommentary", () => {
  let row: StoredRun | null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("COMMENTARY_MODEL_ID", CALLABLE_ENV.COMMENTARY_MODEL_ID);
    vi.stubEnv("AI_GATEWAY_API_KEY", CALLABLE_ENV.AI_GATEWAY_API_KEY);
    vi.stubEnv("COMMENTARY_INPUT_USD_PER_MILLION", CALLABLE_ENV.COMMENTARY_INPUT_USD_PER_MILLION);
    vi.stubEnv("COMMENTARY_OUTPUT_USD_PER_MILLION", CALLABLE_ENV.COMMENTARY_OUTPUT_USD_PER_MILLION);
    row = null;
    mocks.ensureLeaguePersons.mockResolvedValue(0);
    mocks.loadCommentaryWeekView.mockResolvedValue(view);
    mocks.findUnique.mockImplementation(async () => row);
    mocks.create.mockImplementation(async ({ data }: { data: Omit<StoredRun, "id"> }) => {
      if (row) {
        const error = new Error("Unique constraint");
        (error as { code?: string }).code = "P2002";
        throw error;
      }
      row = {
        id: "run-1",
        leagueId: data.leagueId,
        nflSeasonYear: data.nflSeasonYear,
        weekNumber: data.weekNumber,
        status: data.status,
        stopReason: data.stopReason ?? null,
        spendUsd: data.spendUsd ?? new Prisma.Decimal(0),
        sentences: data.sentences ?? [],
      };
      return row;
    });
    mocks.update.mockImplementation(async ({ data }: { data: Partial<StoredRun> }) => {
      row = { ...row!, ...data };
      return row;
    });
  });

  it("stores three matches from one call when spend stays under $1", async () => {
    const sentences = [
      "Alice took Buffalo for two.",
      "Bob lost with the Jets.",
      "Cara tied with Philadelphia.",
    ];
    const promptView: CommentaryWeekViewRow[] = [
      ...view,
      {
        personId: "person-4",
        userDisplayName: "Dee",
        outcome: "WIN",
        points: 1,
        teamAbbreviation: "DAL",
      },
    ];
    mocks.loadCommentaryWeekView
      .mockResolvedValueOnce(promptView)
      .mockResolvedValueOnce(view);
    mocks.generateText.mockResolvedValueOnce(
      modelResult(
        [
          line(view[0], sentences[0]),
          line(view[1], sentences[1]),
          line(view[2], sentences[2]),
          line(promptView[3], "Dee took Dallas."),
        ],
        1_000,
      ),
    );

    const result = await runCommentary({
      leagueId: LEAGUE_ID,
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(mocks.generateText).toHaveBeenCalledOnce();
    const output = mocks.generateText.mock.calls[0][0].output;
    expect(await output.responseFormat).toEqual(
      await Output.object({ schema: commentaryLineListSchema }).responseFormat,
    );
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({ model: "test/model" }),
    );
    expect(result.sentences).not.toContain("Dee took Dallas.");
    expect(row?.sentences).not.toContain("Dee took Dallas.");
    const prompt = mocks.generateText.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("Alice");
    expect(prompt).not.toContain("email");
    expect(result.sentences).toEqual(sentences);
    expect(row?.status).toBe(CommentaryRunStatus.COMPLETED);
    expect(row?.sentences).toEqual(sentences);
    expect(row?.spendUsd.equals("0.001")).toBe(true);
    expect(mocks.ensureLeaguePersons.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.create.mock.invocationCallOrder[0],
    );
    expect(mocks.loadCommentaryWeekView).toHaveBeenCalledTimes(2);
  });

  it("calls again when the first list matches nothing and spend is under $1", async () => {
    const sentences = [
      "Alice took Buffalo for two.",
      "Bob lost with the Jets.",
      "Cara tied with Philadelphia.",
    ];
    mocks.generateText
      .mockResolvedValueOnce(modelResult([{ ...line(view[0], "Not this week."), points: 9 }], 1_000))
      .mockResolvedValueOnce(
        modelResult(
          [line(view[0], sentences[0]), line(view[1], sentences[1]), line(view[2], sentences[2])],
          1_000,
        ),
      );

    const result = await runCommentary({
      leagueId: LEAGUE_ID,
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(result.sentences).toEqual(sentences);
    expect(row?.status).toBe(CommentaryRunStatus.COMPLETED);
    expect(row?.spendUsd.lessThan(1)).toBe(true);
  });

  it("keeps the sentence from the call that crosses $1 and does not call again", async () => {
    const sentence = "Alice took Buffalo for two.";
    mocks.generateText.mockResolvedValueOnce(
      modelResult([line(view[0], sentence)], 1_000_000, 0),
    );

    const result = await runCommentary({
      leagueId: LEAGUE_ID,
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(mocks.generateText).toHaveBeenCalledOnce();
    expect(result.sentences).toEqual([sentence]);
    expect(row?.status).toBe(CommentaryRunStatus.COMPLETED);
    expect(row?.spendUsd.greaterThanOrEqualTo(1)).toBe(true);
  });

  it("keeps a stored sentence when a later call throws and skips the quiet line", async () => {
    const sentence = "Alice took Buffalo for two.";
    mocks.generateText
      .mockResolvedValueOnce(modelResult([line(view[0], sentence)], 1_000))
      .mockRejectedValueOnce(new Error("gateway down"));

    const result = await runCommentary({
      leagueId: LEAGUE_ID,
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(result.sentences).toEqual([]);
    expect(row?.status).toBe(CommentaryRunStatus.STOPPED);
    expect(row?.stopReason).toBe("gateway down");
    expect(row?.sentences).toEqual([sentence]);
    expect(row?.sentences).not.toContain(QUIET_WEEK_SENTENCE);
  });

  it.each([
    ["COMMENTARY_MODEL_ID", "missing COMMENTARY_MODEL_ID"],
    ["AI_GATEWAY_API_KEY", "missing AI_GATEWAY_API_KEY"],
    ["COMMENTARY_INPUT_USD_PER_MILLION", "missing or non-numeric COMMENTARY_INPUT_USD_PER_MILLION"],
  ] as const)("stores a stop and does not call when %s is missing", async (key, stopReason) => {
    vi.stubEnv(key, "");

    const result = await runCommentary({
      leagueId: LEAGUE_ID,
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(result.sentences).toEqual([]);
    expect(row?.status).toBe(CommentaryRunStatus.STOPPED);
    expect(row?.stopReason).toBe(stopReason);
    expect(row?.spendUsd.equals(0)).toBe(true);
  });

  it("does not call when a run already exists, and an unfinished run becomes a stop", async () => {
    row = {
      id: "run-1",
      leagueId: LEAGUE_ID,
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
      status: CommentaryRunStatus.COMPLETED,
      stopReason: null,
      spendUsd: new Prisma.Decimal("0.2"),
      sentences: ["Alice took Buffalo for two."],
    };

    const completed = await runCommentary({
      leagueId: LEAGUE_ID,
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });
    expect(completed.sentences).toEqual(["Alice took Buffalo for two."]);
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();

    row = {
      ...row,
      status: CommentaryRunStatus.STARTED,
      sentences: ["Bob lost with the Jets."],
    };
    const unfinished = await runCommentary({
      leagueId: LEAGUE_ID,
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });
    expect(unfinished.sentences).toEqual([]);
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(row?.status).toBe(CommentaryRunStatus.STOPPED);
    expect(row?.stopReason).toBe("unfinished run");
    expect(row?.sentences).toEqual(["Bob lost with the Jets."]);
  });

  it("stores the quiet sentence only on a normal finish with zero confirms", async () => {
    mocks.generateText.mockResolvedValueOnce(
      modelResult([{ ...line(view[0], "The model wrote this."), points: 9 }], 1_000_000),
    );

    const result = await runCommentary({
      leagueId: LEAGUE_ID,
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(result.sentences).toEqual([QUIET_WEEK_SENTENCE]);
    expect(row?.sentences).toEqual([QUIET_WEEK_SENTENCE]);
    expect(row?.status).toBe(CommentaryRunStatus.COMPLETED);
    expect(mocks.generateText.mock.calls[0][0].prompt).not.toContain(QUIET_WEEK_SENTENCE);
  });

  it("stores a stop and does not call when a price is non-numeric", async () => {
    vi.stubEnv("COMMENTARY_OUTPUT_USD_PER_MILLION", "abc");

    const result = await runCommentary({
      leagueId: LEAGUE_ID,
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(result.sentences).toEqual([]);
    expect(row?.status).toBe(CommentaryRunStatus.STOPPED);
    expect(row?.stopReason).toBe("missing or non-numeric COMMENTARY_OUTPUT_USD_PER_MILLION");
  });

  it("stops once when matching lines have no token usage and keeps them off the digest", async () => {
    const sentence = "Alice took Buffalo for two.";
    mocks.generateText.mockResolvedValueOnce({
      output: { lines: [line(view[0], sentence)] },
    });

    const result = await runCommentary({
      leagueId: LEAGUE_ID,
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(mocks.generateText).toHaveBeenCalledOnce();
    expect(result.sentences).toEqual([]);
    expect(row?.status).toBe(CommentaryRunStatus.STOPPED);
    expect(row?.sentences).toEqual([sentence]);
    expect(row?.stopReason).toBe("model call reported no token spend");
  });

  it("does not call when a concurrent create loses the unique key", async () => {
    mocks.create.mockRejectedValueOnce(Object.assign(new Error("Unique constraint"), { code: "P2002" }));

    const result = await runCommentary({
      leagueId: LEAGUE_ID,
      nflSeasonYear: YEAR,
      weekNumber: WEEK,
    });

    expect(result.sentences).toEqual([]);
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
