import { afterEach, describe, expect, it } from "vitest";

import { getResendFrom } from "./resend-from";

describe("getResendFrom", () => {
  const original = process.env.RESEND_FROM;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.RESEND_FROM;
    } else {
      process.env.RESEND_FROM = original;
    }
  });

  it("returns the default placeholder when RESEND_FROM is unset", () => {
    delete process.env.RESEND_FROM;
    expect(getResendFrom()).toBe("Pick Six <noreply@yourdomain.com>");
  });

  it("returns RESEND_FROM when set", () => {
    process.env.RESEND_FROM = "Pick Six <onboarding@resend.dev>";
    expect(getResendFrom()).toBe("Pick Six <onboarding@resend.dev>");
  });

  it("trims whitespace from RESEND_FROM", () => {
    process.env.RESEND_FROM = "  Pick Six <onboarding@resend.dev>  ";
    expect(getResendFrom()).toBe("Pick Six <onboarding@resend.dev>");
  });

  it("falls back to default when RESEND_FROM is empty or whitespace only", () => {
    process.env.RESEND_FROM = "   ";
    expect(getResendFrom()).toBe("Pick Six <noreply@yourdomain.com>");
  });
});
