import { describe, expect, it } from "vitest";

import { emailSendErrorMessage } from "./email-send-error";

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
