import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendWithRetry } from "./send-with-retry";

describe("sendWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns immediately on success without logging a failure", async () => {
    const sendFn = vi.fn().mockResolvedValue("ok");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const resultPromise = sendWithRetry(sendFn);
    await expect(resultPromise).resolves.toBe("ok");
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("succeeds on the 3rd attempt after two transient failures", async () => {
    const sendFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockRejectedValueOnce(new Error("503 unavailable"))
      .mockResolvedValueOnce("sent");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const resultPromise = sendWithRetry(sendFn, { maxRetries: 3, baseDelayMs: 1000 });

    await vi.runAllTimersAsync();
    await expect(resultPromise).resolves.toBe("sent");
    expect(sendFn).toHaveBeenCalledTimes(3);
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy.mock.calls[0]?.[0]).toBe("[email] attempt 1 failed: network timeout");
    expect(errorSpy.mock.calls[1]?.[0]).toBe("[email] attempt 2 failed: 503 unavailable");
  });

  it("throws immediately on 429 without calling sendFn again", async () => {
    const rateLimitError = { statusCode: 429, message: "daily quota exceeded" };
    const sendFn = vi.fn().mockRejectedValueOnce(rateLimitError);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendWithRetry(sendFn)).rejects.toBe(rateLimitError);
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "[email] daily cap exhausted — will not retry until midnight UTC reset",
      { statusCode: 429 },
    );
  });

  it("rethrows the final error when all retries are exhausted", async () => {
    const finalError = new Error("persistent failure");
    const sendFn = vi.fn().mockRejectedValue(finalError);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const resultPromise = sendWithRetry(sendFn, { maxRetries: 2, baseDelayMs: 100 });
    const handled = resultPromise.catch((err: unknown) => err);

    await vi.runAllTimersAsync();

    await expect(handled).resolves.toBe(finalError);
    expect(sendFn).toHaveBeenCalledTimes(3);
    expect(errorSpy).toHaveBeenCalledTimes(3);
  });
});
