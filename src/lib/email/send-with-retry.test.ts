import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLogEvent = vi.fn();

vi.mock("@/lib/logging/log-event", () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

import { sendWithRetry } from "./send-with-retry";

describe("sendWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockLogEvent.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns immediately on success without logging a failure", async () => {
    const sendFn = vi.fn().mockResolvedValue("ok");

    const resultPromise = sendWithRetry(sendFn);
    await expect(resultPromise).resolves.toBe("ok");
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it("succeeds on the 3rd attempt after two transient failures", async () => {
    const sendFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockRejectedValueOnce(new Error("503 unavailable"))
      .mockResolvedValueOnce("sent");

    const resultPromise = sendWithRetry(sendFn, { maxRetries: 3, baseDelayMs: 1000 });

    await vi.runAllTimersAsync();
    await expect(resultPromise).resolves.toBe("sent");
    expect(sendFn).toHaveBeenCalledTimes(3);
    expect(mockLogEvent).toHaveBeenCalledTimes(2);
    expect(mockLogEvent.mock.calls[0]?.[0]).toMatchObject({
      level: "error",
      domain: "email",
      action: "send_retry_failed",
      context: { attempt: 1 },
    });
    expect(mockLogEvent.mock.calls[1]?.[0]).toMatchObject({
      action: "send_retry_failed",
      context: { attempt: 2 },
    });
  });

  it("throws immediately on 429 without calling sendFn again", async () => {
    const rateLimitError = { statusCode: 429, message: "daily quota exceeded" };
    const sendFn = vi.fn().mockRejectedValueOnce(rateLimitError);

    await expect(sendWithRetry(sendFn)).rejects.toBe(rateLimitError);
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "error",
        domain: "email",
        action: "daily_cap_exhausted",
        code: "EMAIL_DAILY_CAP",
      }),
    );
  });

  it("rethrows the final error when all retries are exhausted", async () => {
    const finalError = new Error("persistent failure");
    const sendFn = vi.fn().mockRejectedValue(finalError);

    const resultPromise = sendWithRetry(sendFn, { maxRetries: 2, baseDelayMs: 100 });
    const handled = resultPromise.catch((err: unknown) => err);

    await vi.runAllTimersAsync();

    await expect(handled).resolves.toBe(finalError);
    expect(sendFn).toHaveBeenCalledTimes(3);
    expect(mockLogEvent).toHaveBeenCalledTimes(3);
  });
});
