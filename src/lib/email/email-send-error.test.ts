import { describe, expect, it } from "vitest";

import {
  emailSendErrorMessage,
  isQuotaExceededError,
  isRateLimitError,
} from "./email-send-error";

describe("emailSendErrorMessage", () => {
  it("uses Error.message", () => {
    expect(emailSendErrorMessage(new Error("network timeout"))).toBe("network timeout");
  });

  it("formats Resend-style plain objects instead of [object Object]", () => {
    expect(
      emailSendErrorMessage({
        name: "validation_error",
        statusCode: 422,
        message: "Invalid `to` field",
      }),
    ).toBe("validation_error: 422: Invalid `to` field");
  });

  it("uses message when name and statusCode are missing", () => {
    expect(emailSendErrorMessage({ message: "daily quota exceeded" })).toBe(
      "daily quota exceeded",
    );
  });

  it("falls back to String() for primitives", () => {
    expect(emailSendErrorMessage("boom")).toBe("boom");
  });
});

describe("isQuotaExceededError", () => {
  it("matches named daily and monthly quota errors", () => {
    expect(
      isQuotaExceededError({ statusCode: 429, name: "daily_quota_exceeded" }),
    ).toBe(true);
    expect(isQuotaExceededError({ name: "monthly_quota_exceeded" })).toBe(true);
  });

  it("does not match per-second or unlabeled 429s", () => {
    expect(
      isQuotaExceededError({ statusCode: 429, name: "rate_limit_exceeded" }),
    ).toBe(false);
    expect(isQuotaExceededError({ statusCode: 429 })).toBe(false);
    expect(isQuotaExceededError(new Error("429"))).toBe(false);
  });
});

describe("isRateLimitError", () => {
  it("matches rate_limit_exceeded and unlabeled 429s", () => {
    expect(
      isRateLimitError({ statusCode: 429, name: "rate_limit_exceeded" }),
    ).toBe(true);
    expect(isRateLimitError({ statusCode: 429 })).toBe(true);
  });

  it("excludes named quota errors", () => {
    expect(
      isRateLimitError({ statusCode: 429, name: "daily_quota_exceeded" }),
    ).toBe(false);
    expect(isRateLimitError({ name: "monthly_quota_exceeded" })).toBe(false);
  });
});
