import { describe, expect, it } from "vitest";

import {
  hashInviteToken,
  inviteSignupBodySchema,
  INVITE_TOKEN_MAX_LENGTH,
  isInvitationUsable,
  SIGNUP_PASSWORD_MIN_LENGTH,
  SIGNUP_PASSWORD_REGEX,
} from "./invitations";

describe("hashInviteToken", () => {
  it("returns deterministic SHA-256 hex for a given raw token", () => {
    expect(hashInviteToken("test")).toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    );
  });

  it("produces different hashes for different inputs", () => {
    expect(hashInviteToken("a")).not.toBe(hashInviteToken("b"));
  });
});

describe("SIGNUP_PASSWORD_REGEX", () => {
  it("requires 8+ chars with at least one digit and one special", () => {
    expect(SIGNUP_PASSWORD_MIN_LENGTH).toBe(8);
    expect(SIGNUP_PASSWORD_REGEX.test("abcdef7!")).toBe(true);
    expect(SIGNUP_PASSWORD_REGEX.test("abcdefgh")).toBe(false);
    expect(SIGNUP_PASSWORD_REGEX.test("abcdefg!")).toBe(false);
    expect(SIGNUP_PASSWORD_REGEX.test("abcdefg1")).toBe(false);
  });
});

describe("isInvitationUsable", () => {
  const future = new Date("2099-01-01T00:00:00.000Z");
  const past = new Date("2020-01-01T00:00:00.000Z");

  it("returns false for null", () => {
    expect(isInvitationUsable(null, future)).toBe(false);
  });

  it("returns false when consumed", () => {
    expect(isInvitationUsable({ consumedAt: past, expiresAt: future }, future)).toBe(false);
  });

  it("returns false when expired", () => {
    expect(isInvitationUsable({ consumedAt: null, expiresAt: past }, future)).toBe(false);
  });

  it("returns true when not consumed and before expiry", () => {
    expect(isInvitationUsable({ consumedAt: null, expiresAt: future }, past)).toBe(true);
  });
});

describe("inviteSignupBodySchema", () => {
  it("rejects tokens longer than INVITE_TOKEN_MAX_LENGTH", () => {
    const token = "a".repeat(INVITE_TOKEN_MAX_LENGTH + 1);
    const r = inviteSignupBodySchema.safeParse({ token, password: "abcd1234!" });
    expect(r.success).toBe(false);
  });
});
