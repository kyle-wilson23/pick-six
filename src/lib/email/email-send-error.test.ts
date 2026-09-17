import { describe, expect, it } from "vitest";

import {
  classifyResend429,
  emailSendErrorMessage,
  isNonRetryableResendQuota,
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

describe("classifyResend429", () => {
  it("returns null when the status is not 429", () => {
    expect(classifyResend429({ statusCode: 422, name: "validation_error" })).toBeNull();
  });

  it("detects daily quota by name", () => {
    expect(
      classifyResend429({
        statusCode: 429,
        name: "daily_quota_exceeded",
        message: "You have exceeded your daily email sending quota.",
      }),
    ).toBe("daily_quota");
  });

  it("detects monthly quota by name", () => {
    expect(
      classifyResend429({
        statusCode: 429,
        name: "monthly_quota_exceeded",
        message: "You have exceeded your monthly email sending quota.",
      }),
    ).toBe("monthly_quota");
  });

  it("detects per-second rate limits by name", () => {
    expect(
      classifyResend429({
        statusCode: 429,
        name: "rate_limit_exceeded",
        message: "Too many requests. Please limit the number of requests per second.",
      }),
    ).toBe("rate_limit");
  });

  it("classifies unlabeled 429s as unknown so they can be retried", () => {
    expect(classifyResend429({ statusCode: 429, message: "daily quota exceeded" })).toBe(
      "daily_quota",
    );
    expect(classifyResend429({ statusCode: 429 })).toBe("unknown");
  });
});

describe("isNonRetryableResendQuota", () => {
  it("short-circuits only named quota 429s", () => {
    expect(
      isNonRetryableResendQuota({ statusCode: 429, name: "daily_quota_exceeded" }),
    ).toBe(true);
    expect(
      isNonRetryableResendQuota({ statusCode: 429, name: "monthly_quota_exceeded" }),
    ).toBe(true);
    expect(isNonRetryableResendQuota({ statusCode: 429 })).toBe(false);
    expect(
      isNonRetryableResendQuota({ statusCode: 429, name: "rate_limit_exceeded" }),
    ).toBe(false);
  });
});
