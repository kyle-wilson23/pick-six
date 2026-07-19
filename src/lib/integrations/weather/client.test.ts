import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { clearWeatherCacheForTests, fetchWeatherForGame } from "./client";
import { getStadiumRoof } from "./stadium-locations";
import forecastFixture from "./fixtures/owm-forecast-sample.json";

// dt values from the fixture
const DT_FIRST = 1752350400; // first slot
const DT_SECOND = 1752361200; // second slot (3 hours later)

const VALID_ABBR = "KC"; // Kansas City — present in stadium-locations map

function makeKickoffFromDt(dt: number): Date {
  return new Date(dt * 1000);
}

/** Returns a Date that is `days` days in the future from a fake "now". */
function daysFromNow(days: number, nowMs: number): Date {
  return new Date(nowMs + days * 24 * 60 * 60 * 1000);
}

describe("fetchWeatherForGame", () => {
  const REAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...REAL_ENV, WEATHER_API_KEY: "test-key" };
    clearWeatherCacheForTests();
    // Pin Date.now() to 2 days before DT_FIRST so fixture dt values are "in the future".
    vi.useFakeTimers();
    vi.setSystemTime(new Date((DT_FIRST - 2 * 24 * 60 * 60) * 1000));
  });

  afterEach(() => {
    process.env = REAL_ENV;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("TTL cache", () => {
    it("reuses a successful response within the TTL without a second fetch", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(forecastFixture), { status: 200 }),
      );
      const kickoff = makeKickoffFromDt(DT_FIRST);

      const first = await fetchWeatherForGame(VALID_ABBR, kickoff);
      const second = await fetchWeatherForGame(VALID_ABBR, kickoff);

      expect(first).not.toBeNull();
      expect(second).toEqual(first);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("refetches after the TTL expires", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(forecastFixture), { status: 200 }),
      );
      const kickoff = makeKickoffFromDt(DT_FIRST);

      await fetchWeatherForGame(VALID_ABBR, kickoff);
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);
      await fetchWeatherForGame(VALID_ABBR, kickoff);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("nearest forecast slot selection", () => {
    it("selects the slot whose dt is closest to kickoffAt — first entry wins", async () => {
      // Kickoff exactly at first dt → first entry should be chosen
      const kickoff = makeKickoffFromDt(DT_FIRST);

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(forecastFixture), { status: 200 }),
      );

      const result = await fetchWeatherForGame(VALID_ABBR, kickoff);

      expect(result).not.toBeNull();
      // First fixture entry: temp 68.2 → rounds to 68, wind 7.5 → rounds to 8
      expect(result?.tempF).toBe(68);
      expect(result?.windMph).toBe(8);
      expect(result?.condition).toBe("Overcast Clouds");
    });

    it("selects the slot whose dt is closest to kickoffAt — second entry wins", async () => {
      // Kickoff exactly at second dt → second entry should be chosen
      const kickoff = makeKickoffFromDt(DT_SECOND);

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(forecastFixture), { status: 200 }),
      );

      const result = await fetchWeatherForGame(VALID_ABBR, kickoff);

      expect(result).not.toBeNull();
      // Second fixture entry: temp 74.5 → rounds to 75, wind 4.2 → rounds to 4
      expect(result?.tempF).toBe(75);
      expect(result?.windMph).toBe(4);
      expect(result?.condition).toBe("Clear Sky");
    });

    it("selects the closer slot when kickoff is between two entries", async () => {
      // Midpoint is (DT_FIRST + DT_SECOND) / 2 = DT_FIRST + 5400
      // A kickoff 1s past midpoint should resolve to the second entry
      const midpointDt = DT_FIRST + 5400 + 1;
      const kickoff = makeKickoffFromDt(midpointDt);

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(forecastFixture), { status: 200 }),
      );

      const result = await fetchWeatherForGame(VALID_ABBR, kickoff);

      expect(result).not.toBeNull();
      expect(result?.tempF).toBe(75); // second entry
    });
  });

  describe("invalid kickoff date", () => {
    it("returns null without calling fetch when kickoffAt is an invalid date (NaN)", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const result = await fetchWeatherForGame(VALID_ABBR, new Date(NaN));
      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns null without calling fetch when kickoffAt is in the past", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const pastKickoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const result = await fetchWeatherForGame(VALID_ABBR, pastKickoff);
      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("outside-horizon null return", () => {
    it("returns null without calling fetch when kickoffAt is more than 5 days away", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const nowMs = Date.now();
      const kickoff = daysFromNow(6, nowMs); // 6 days > 5-day horizon

      const result = await fetchWeatherForGame(VALID_ABBR, kickoff);

      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("does not return null when kickoffAt is exactly at the horizon boundary (5 days)", async () => {
      // 5 days * 86400s = 432000s, which equals FORECAST_HORIZON_SECONDS exactly → NOT beyond → fetch is called
      const nowMs = Date.now();
      const kickoff = new Date(nowMs + 5 * 24 * 60 * 60 * 1000);

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(forecastFixture), { status: 200 }),
      );

      // Should call fetch — result may be non-null (fixture has data)
      const result = await fetchWeatherForGame(VALID_ABBR, kickoff);
      // As long as fetch was called and we got a result, the horizon check passes
      expect(result).not.toBeNull();
    });
  });

  describe("empty or missing list returns null", () => {
    it("returns null when forecast list is empty", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ list: [] }), { status: 200 }),
      );

      const kickoff = makeKickoffFromDt(DT_FIRST);
      const result = await fetchWeatherForGame(VALID_ABBR, kickoff);

      expect(result).toBeNull();
    });

    it("returns null when forecast list is undefined", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      );

      const kickoff = makeKickoffFromDt(DT_FIRST);
      const result = await fetchWeatherForGame(VALID_ABBR, kickoff);

      expect(result).toBeNull();
    });
  });

  describe("missing API key returns null", () => {
    it("returns null without calling fetch when WEATHER_API_KEY is not set", async () => {
      delete process.env.WEATHER_API_KEY;

      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const kickoff = makeKickoffFromDt(DT_FIRST);

      const result = await fetchWeatherForGame(VALID_ABBR, kickoff);

      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns null when WEATHER_API_KEY is an empty string", async () => {
      process.env.WEATHER_API_KEY = "   ";

      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const kickoff = makeKickoffFromDt(DT_FIRST);

      const result = await fetchWeatherForGame(VALID_ABBR, kickoff);

      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("network error returns null", () => {
    it("returns null when fetch throws a network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network failure"));

      const kickoff = makeKickoffFromDt(DT_FIRST);
      const result = await fetchWeatherForGame(VALID_ABBR, kickoff);

      expect(result).toBeNull();
    });

    it("returns null when the API returns a non-OK status", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 }),
      );

      const kickoff = makeKickoffFromDt(DT_FIRST);
      const result = await fetchWeatherForGame(VALID_ABBR, kickoff);

      expect(result).toBeNull();
    });

    it("returns null when the response body is not valid JSON", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("not json", { status: 200 }),
      );

      const kickoff = makeKickoffFromDt(DT_FIRST);
      const result = await fetchWeatherForGame(VALID_ABBR, kickoff);

      expect(result).toBeNull();
    });
  });

  describe("unknown abbreviation returns null", () => {
    it("returns null when the team abbreviation has no stadium entry", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const kickoff = makeKickoffFromDt(DT_FIRST);

      const result = await fetchWeatherForGame("UNKNOWN", kickoff);

      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});

describe("getStadiumRoof", () => {
  it("returns 'dome' for a known dome stadium (DET — Ford Field)", () => {
    expect(getStadiumRoof("DET")).toBe("dome");
  });

  it("returns 'dome' for a known dome stadium regardless of case (lv)", () => {
    expect(getStadiumRoof("lv")).toBe("dome");
  });

  it("returns 'retractable' for a known retractable-roof stadium (DAL — AT&T Stadium)", () => {
    expect(getStadiumRoof("DAL")).toBe("retractable");
  });

  it("returns null for an outdoor stadium (KC)", () => {
    expect(getStadiumRoof("KC")).toBeNull();
  });

  it("returns null for an unknown abbreviation", () => {
    expect(getStadiumRoof("UNKNOWN")).toBeNull();
  });
});
