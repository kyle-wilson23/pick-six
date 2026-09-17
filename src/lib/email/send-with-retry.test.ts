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

  it("retries rate_limit_exceeded 429s and does not log EMAIL_DAILY_CAP", async () => {
    const rateLimitError = { statusCode: 429, name: "rate_limit_exceeded" };
    const sendFn = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce("sent");

    const resultPromise = sendWithRetry(sendFn, { maxRetries: 3, baseDelayMs: 1000 });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toBe("sent");
    expect(sendFn).toHaveBeenCalledTimes(2);
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "send_retry_failed",
        context: { attempt: 1 },
      }),
    );
    expect(mockLogEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: "EMAIL_DAILY_CAP" }),
    );
  });

  it("retries unlabeled 429s the same way as rate_limit_exceeded", async () => {
    const unlabeled = { statusCode: 429, message: "Too Many Requests" };
    const sendFn = vi.fn().mockRejectedValueOnce(unlabeled).mockResolvedValueOnce("sent");

    const resultPromise = sendWithRetry(sendFn, { maxRetries: 3, baseDelayMs: 1000 });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toBe("sent");
    expect(sendFn).toHaveBeenCalledTimes(2);
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "send_retry_failed",
        context: { attempt: 1 },
      }),
    );
    expect(mockLogEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: "EMAIL_DAILY_CAP" }),
    );
  });

  it("throws immediately on daily_quota_exceeded without retrying", async () => {
    const quotaError = { statusCode: 429, name: "daily_quota_exceeded" };
    const sendFn = vi.fn().mockRejectedValueOnce(quotaError);

    await expect(sendWithRetry(sendFn)).rejects.toBe(quotaError);
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "error",
        domain: "email",
        action: "daily_cap_exhausted",
        code: "EMAIL_DAILY_CAP",
      }),
    );
    expect(mockLogEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "send_retry_failed" }),
    );
  });

  it("throws immediately on monthly_quota_exceeded without retrying", async () => {
    const quotaError = { name: "monthly_quota_exceeded" };
    const sendFn = vi.fn().mockRejectedValueOnce(quotaError);

    await expect(sendWithRetry(sendFn)).rejects.toBe(quotaError);
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ code: "EMAIL_DAILY_CAP" }),
    );
  });

  it("waits max(retryAfter seconds, computed backoff) before retrying", async () => {
    const rateLimitError = {
      statusCode: 429,
      name: "rate_limit_exceeded",
      retryAfter: 5,
    };
    const sendFn = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce("sent");

    const resultPromise = sendWithRetry(sendFn, { maxRetries: 3, baseDelayMs: 1000 });

    await vi.advanceTimersByTimeAsync(4999);
    expect(sendFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(resultPromise).resolves.toBe("sent");
    expect(sendFn).toHaveBeenCalledTimes(2);
  });

  it("exhausts retries on persistent rate_limit_exceeded", async () => {
    const rateLimitError = { statusCode: 429, name: "rate_limit_exceeded" };
    const sendFn = vi.fn().mockRejectedValue(rateLimitError);

    const resultPromise = sendWithRetry(sendFn, { maxRetries: 3, baseDelayMs: 100 });
    const handled = resultPromise.catch((err: unknown) => err);

    await vi.runAllTimersAsync();

    await expect(handled).resolves.toBe(rateLimitError);
    expect(sendFn).toHaveBeenCalledTimes(4);
    expect(mockLogEvent).toHaveBeenCalledTimes(4);
    expect(mockLogEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: "EMAIL_DAILY_CAP" }),
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
