import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import sampleOdds from "@/lib/integrations/the-odds-api/fixtures/nfl-odds-sample.json";
import {
  clearLiveDisplayOddsCacheForTests,
  getLiveDisplayOddsLinesForWeek,
  LIVE_DISPLAY_ODDS_TTL_MS,
  mergeLiveDisplayOddsOverEffective,
  shouldUseLiveDisplayOdds,
} from "./live-display-odds";

const fetchAmericanFootballNflOdds = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integrations/the-odds-api/client", () => ({
  fetchAmericanFootballNflOdds,
  TheOddsApiError: class TheOddsApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
      this.name = "TheOddsApiError";
    }
  },
}));

const GAMES = [
  {
    id: "game-kc-lv",
    homeTeamName: "Kansas City Chiefs",
    awayTeamName: "Las Vegas Raiders",
  },
  {
    id: "game-unmatched",
    homeTeamName: "Buffalo Bills",
    awayTeamName: "Miami Dolphins",
  },
];

describe("shouldUseLiveDisplayOdds", () => {
  it("is true only for non-test leagues on the resolved (current) week", () => {
    expect(
      shouldUseLiveDisplayOdds({
        isTestLeague: false,
        targetWeek: 3,
        resolvedWeek: 3,
      }),
    ).toBe(true);
  });

  it("is false for test leagues", () => {
    expect(
      shouldUseLiveDisplayOdds({
        isTestLeague: true,
        targetWeek: 3,
        resolvedWeek: 3,
      }),
    ).toBe(false);
  });

  it("is false when browsing a past week via explicit weekNumber", () => {
    expect(
      shouldUseLiveDisplayOdds({
        isTestLeague: false,
        targetWeek: 2,
        resolvedWeek: 3,
      }),
    ).toBe(false);
  });
});

describe("getLiveDisplayOddsLinesForWeek", () => {
  const REAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...REAL_ENV, ODDS_API_KEY: "test-odds-key" };
    clearLiveDisplayOddsCacheForTests();
    fetchAmericanFootballNflOdds.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T12:00:00Z"));
  });

  afterEach(() => {
    process.env = REAL_ENV;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns null when ODDS_API_KEY is missing (no provider call)", async () => {
    delete process.env.ODDS_API_KEY;
    const out = await getLiveDisplayOddsLinesForWeek({
      nflSeasonYear: 2026,
      weekNumber: 1,
      games: GAMES,
    });
    expect(out).toBeNull();
    expect(fetchAmericanFootballNflOdds).not.toHaveBeenCalled();
  });

  it("maps provider events onto matched games and leaves unmatched out of the live map", async () => {
    fetchAmericanFootballNflOdds.mockResolvedValueOnce(sampleOdds);
    const out = await getLiveDisplayOddsLinesForWeek({
      nflSeasonYear: 2026,
      weekNumber: 1,
      games: GAMES,
    });
    expect(out).not.toBeNull();
    expect(out!.has("game-kc-lv")).toBe(true);
    expect(out!.get("game-kc-lv")?.homeMoneylineAmerican).toBe(1.4);
    expect(out!.get("game-kc-lv")?.awayMoneylineAmerican).toBe(3.1);
    expect(out!.get("game-kc-lv")?.homeSpreadPoints).toBe(-7.5);
    expect(out!.has("game-unmatched")).toBe(false);
  });

  it("reuses a successful response within the TTL without a second fetch", async () => {
    fetchAmericanFootballNflOdds.mockResolvedValue(sampleOdds);
    const args = { nflSeasonYear: 2026, weekNumber: 1, games: GAMES };

    const first = await getLiveDisplayOddsLinesForWeek(args);
    const second = await getLiveDisplayOddsLinesForWeek(args);

    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(fetchAmericanFootballNflOdds).toHaveBeenCalledTimes(1);
  });

  it("refetches after the TTL expires", async () => {
    fetchAmericanFootballNflOdds.mockResolvedValue(sampleOdds);
    const args = { nflSeasonYear: 2026, weekNumber: 1, games: GAMES };

    await getLiveDisplayOddsLinesForWeek(args);
    vi.advanceTimersByTime(LIVE_DISPLAY_ODDS_TTL_MS + 1);
    await getLiveDisplayOddsLinesForWeek(args);

    expect(fetchAmericanFootballNflOdds).toHaveBeenCalledTimes(2);
  });

  it("returns null on provider failure without caching (next call retries)", async () => {
    fetchAmericanFootballNflOdds
      .mockRejectedValueOnce(new Error("upstream down"))
      .mockResolvedValueOnce(sampleOdds);

    const args = { nflSeasonYear: 2026, weekNumber: 1, games: GAMES };
    const failed = await getLiveDisplayOddsLinesForWeek(args);
    expect(failed).toBeNull();

    const ok = await getLiveDisplayOddsLinesForWeek(args);
    expect(ok).not.toBeNull();
    expect(fetchAmericanFootballNflOdds).toHaveBeenCalledTimes(2);
  });

  it("does not cache when no games match (next call retries)", async () => {
    fetchAmericanFootballNflOdds
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(sampleOdds);

    const args = { nflSeasonYear: 2026, weekNumber: 1, games: GAMES };
    const empty = await getLiveDisplayOddsLinesForWeek(args);
    expect(empty).toBeNull();

    const ok = await getLiveDisplayOddsLinesForWeek(args);
    expect(ok).not.toBeNull();
    expect(fetchAmericanFootballNflOdds).toHaveBeenCalledTimes(2);
  });

  it("drops incomplete matched lines so they cannot wipe baseline odds", async () => {
    const incomplete = [
      {
        ...sampleOdds[0],
        bookmakers: [
          {
            key: "draftkings",
            title: "DraftKings",
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Kansas City Chiefs", price: 1.4 },
                  { name: "Las Vegas Raiders", price: 3.1 },
                ],
              },
              // spreads market missing → incomplete line
            ],
          },
        ],
      },
    ];
    fetchAmericanFootballNflOdds.mockResolvedValueOnce(incomplete);

    const out = await getLiveDisplayOddsLinesForWeek({
      nflSeasonYear: 2026,
      weekNumber: 1,
      games: GAMES,
    });
    expect(out).toBeNull();
  });

  it("coalesces concurrent cache misses into one provider call", async () => {
    let resolveFetch: (value: typeof sampleOdds) => void = () => {};
    fetchAmericanFootballNflOdds.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const args = { nflSeasonYear: 2026, weekNumber: 1, games: GAMES };
    const p1 = getLiveDisplayOddsLinesForWeek(args);
    const p2 = getLiveDisplayOddsLinesForWeek(args);
    resolveFetch(sampleOdds);
    const [a, b] = await Promise.all([p1, p2]);

    expect(a).not.toBeNull();
    expect(b).toEqual(a);
    expect(fetchAmericanFootballNflOdds).toHaveBeenCalledTimes(1);
  });
});

describe("mergeLiveDisplayOddsOverEffective", () => {
  it("keeps baseline when live is null or empty", () => {
    const baseline = new Map([
      [
        "g1",
        {
          homeMoneylineAmerican: -110,
          awayMoneylineAmerican: -110,
          homeSpreadPoints: -3,
        },
      ],
    ]);
    expect(mergeLiveDisplayOddsOverEffective(baseline, null)).toEqual(baseline);
    expect(mergeLiveDisplayOddsOverEffective(baseline, new Map())).toEqual(baseline);
  });

  it("overlays complete matched games and leaves unmatched baseline lines", () => {
    const baseline = new Map([
      [
        "game-kc-lv",
        {
          homeMoneylineAmerican: -200,
          awayMoneylineAmerican: 170,
          homeSpreadPoints: -6.5,
        },
      ],
      [
        "game-unmatched",
        {
          homeMoneylineAmerican: -120,
          awayMoneylineAmerican: 100,
          homeSpreadPoints: -2.5,
        },
      ],
    ]);
    const live = new Map([
      [
        "game-kc-lv",
        {
          homeMoneylineAmerican: -250,
          awayMoneylineAmerican: 210,
          homeSpreadPoints: -7.5,
        },
      ],
    ]);

    const merged = mergeLiveDisplayOddsOverEffective(baseline, live);
    expect(merged.get("game-kc-lv")?.homeMoneylineAmerican).toBe(-250);
    expect(merged.get("game-kc-lv")?.homeSpreadPoints).toBe(-7.5);
    expect(merged.get("game-unmatched")?.homeMoneylineAmerican).toBe(-120);
    expect(merged.get("game-unmatched")?.homeSpreadPoints).toBe(-2.5);
  });

  it("ignores incomplete live lines so baseline odds are preserved", () => {
    const baseline = new Map([
      [
        "game-kc-lv",
        {
          homeMoneylineAmerican: -200,
          awayMoneylineAmerican: 170,
          homeSpreadPoints: -6.5,
        },
      ],
    ]);
    const live = new Map([
      [
        "game-kc-lv",
        {
          homeMoneylineAmerican: -250,
          awayMoneylineAmerican: 210,
          homeSpreadPoints: null,
        },
      ],
    ]);

    const merged = mergeLiveDisplayOddsOverEffective(baseline, live);
    expect(merged.get("game-kc-lv")).toEqual(baseline.get("game-kc-lv"));
  });
});
