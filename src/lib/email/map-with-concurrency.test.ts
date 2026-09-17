import { describe, expect, it, vi } from "vitest";

import {
  EMAIL_SEND_CONCURRENCY,
  EMAIL_SEND_MIN_INTERVAL_MS,
  mapWithConcurrency,
} from "./map-with-concurrency";

describe("mapWithConcurrency", () => {
  it("maps all items and preserves order", async () => {
    const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(results).toEqual([10, 20, 30, 40]);
  });

  it("respects concurrency limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("stops starting new work when shouldAbort becomes true", async () => {
    let started = 0;
    let abort = false;

    await mapWithConcurrency(
      [1, 2, 3, 4, 5, 6],
      1,
      async () => {
        started += 1;
        if (started >= 2) {
          abort = true;
        }
      },
      { shouldAbort: () => abort },
    );

    expect(started).toBeLessThan(6);
  });

  it("returns empty array for empty input", async () => {
    const mapper = vi.fn();
    await expect(mapWithConcurrency([], 4, mapper)).resolves.toEqual([]);
    expect(mapper).not.toHaveBeenCalled();
  });

  it("exports 125ms min interval and keeps concurrency at 4", () => {
    expect(EMAIL_SEND_MIN_INTERVAL_MS).toBe(125);
    expect(EMAIL_SEND_CONCURRENCY).toBe(4);
  });

  it("spaces mapper starts by minIntervalMs even at concurrency 4", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const starts: number[] = [];
    const items = Array.from({ length: 15 }, (_, i) => i);

    try {
      const done = mapWithConcurrency(
        items,
        EMAIL_SEND_CONCURRENCY,
        async () => {
          starts.push(Date.now());
        },
        { minIntervalMs: EMAIL_SEND_MIN_INTERVAL_MS },
      );

      await vi.runAllTimersAsync();
      await done;

      expect(starts).toHaveLength(15);
      for (let i = 1; i < starts.length; i++) {
        expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(EMAIL_SEND_MIN_INTERVAL_MS);
      }
      expect(starts[14]! - starts[0]!).toBeGreaterThanOrEqual(
        14 * EMAIL_SEND_MIN_INTERVAL_MS,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
