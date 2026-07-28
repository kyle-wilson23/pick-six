import { describe, expect, it } from "vitest";

import {
  forgotPasswordBodySchema,
  hashPasswordResetToken,
  isPasswordResetUsable,
  PASSWORD_RESET_TOKEN_MAX_LENGTH,
  PASSWORD_RESET_TTL_MS,
  resetPasswordBodySchema,
} from "./password-reset";

describe("hashPasswordResetToken", () => {
  it("returns deterministic SHA-256 hex for a given raw token", () => {
    expect(hashPasswordResetToken("test")).toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    );
  });
});

describe("PASSWORD_RESET_TTL_MS", () => {
  it("is one hour", () => {
    expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000);
  });
});

describe("isPasswordResetUsable", () => {
  const future = new Date("2099-01-01T00:00:00.000Z");
  const past = new Date("2020-01-01T00:00:00.000Z");

  it("returns false for null", () => {
    expect(isPasswordResetUsable(null, future)).toBe(false);
  });

  it("returns false when consumed", () => {
    expect(isPasswordResetUsable({ consumedAt: past, expiresAt: future }, future)).toBe(false);
  });

  it("returns false when expired", () => {
    expect(isPasswordResetUsable({ consumedAt: null, expiresAt: past }, future)).toBe(false);
  });

  it("returns true when not consumed and before expiry", () => {
    expect(isPasswordResetUsable({ consumedAt: null, expiresAt: future }, past)).toBe(true);
  });
});

describe("forgotPasswordBodySchema", () => {
  it("accepts a valid email", () => {
    const r = forgotPasswordBodySchema.safeParse({ email: "user@example.com" });
    expect(r.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const r = forgotPasswordBodySchema.safeParse({ email: "not-an-email" });
    expect(r.success).toBe(false);
  });
});

describe("resetPasswordBodySchema", () => {
  it("rejects tokens longer than PASSWORD_RESET_TOKEN_MAX_LENGTH", () => {
    const token = "a".repeat(PASSWORD_RESET_TOKEN_MAX_LENGTH + 1);
    const r = resetPasswordBodySchema.safeParse({ token, password: "abcd1234!" });
    expect(r.success).toBe(false);
  });

  it("enforces signup password policy", () => {
    const r = resetPasswordBodySchema.safeParse({
      token: "valid-token",
      password: "weak",
    });
    expect(r.success).toBe(false);
  });

  it("accepts valid token and password", () => {
    const r = resetPasswordBodySchema.safeParse({
      token: "valid-token",
      password: "abcd1234!",
    });
    expect(r.success).toBe(true);
  });
});
