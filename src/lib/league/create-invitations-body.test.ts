import { describe, expect, it } from "vitest";

import {
  createInvitationsBodySchema,
  MAX_INVITE_EMAILS_PER_REQUEST,
  normalizeInviteEmailList,
} from "./create-invitations-body";

describe("normalizeInviteEmailList", () => {
  it("trims, lowercases, and dedupes in order", () => {
    expect(
      normalizeInviteEmailList(["  A@X.COM ", "a@x.com", "  B@Y.COM"]),
    ).toEqual(["a@x.com", "b@y.com"]);
  });

  it("drops empty entries after normalization", () => {
    expect(normalizeInviteEmailList(["", "   ", "\t"])).toEqual([]);
  });
});

describe("createInvitationsBodySchema", () => {
  it("accepts a valid email list", () => {
    const r = createInvitationsBodySchema.safeParse({
      emails: ["one@example.com", "two@example.com"],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.emails).toEqual(["one@example.com", "two@example.com"]);
    }
  });

  it("rejects empty list", () => {
    const r = createInvitationsBodySchema.safeParse({ emails: [] });
    expect(r.success).toBe(false);
  });

  it("rejects more than MAX_INVITE_EMAILS_PER_REQUEST", () => {
    const emails = Array.from({ length: MAX_INVITE_EMAILS_PER_REQUEST + 1 }, (_, i) => `u${i}@x.com`);
    const r = createInvitationsBodySchema.safeParse({ emails });
    expect(r.success).toBe(false);
  });

  it("rejects invalid email shape", () => {
    const r = createInvitationsBodySchema.safeParse({ emails: ["not-an-email"] });
    expect(r.success).toBe(false);
  });

  it("dedupes before validation", () => {
    const r = createInvitationsBodySchema.safeParse({
      emails: ["a@x.com", "  A@X.COM  "],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.emails).toEqual(["a@x.com"]);
    }
  });
});
