import { describe, expect, it } from "vitest";

import {
  ADMIN_NOTE_MAX_LENGTH,
  adminNoteBodySchema,
  adminNoteSendBodySchema,
  adminNoteSubject,
  parseAdminNoteBody,
  parseAdminNoteSendBody,
} from "./admin-note";

describe("adminNoteSubject", () => {
  it("uses the commissioner-note subject and [TEST] prefix for test leagues", () => {
    expect(adminNoteSubject("Gridiron", false)).toBe(
      "[Gridiron] A note from your commissioner",
    );
    expect(adminNoteSubject("Gridiron", true)).toBe(
      "[TEST][Gridiron] A note from your commissioner",
    );
  });
});

describe("adminNoteBodySchema", () => {
  it("trims and accepts a 1–2000 character note", () => {
    expect(adminNoteBodySchema.parse({ note: "  hello  " })).toEqual({ note: "hello" });
  });

  it("rejects empty, whitespace, and overlong notes", () => {
    expect(adminNoteBodySchema.safeParse({ note: "" }).success).toBe(false);
    expect(adminNoteBodySchema.safeParse({ note: "   " }).success).toBe(false);
    expect(
      adminNoteBodySchema.safeParse({ note: "x".repeat(ADMIN_NOTE_MAX_LENGTH + 1) }).success,
    ).toBe(false);
  });
});

describe("adminNoteSendBodySchema", () => {
  it("requires recipientMembershipIds alongside a note", () => {
    expect(
      adminNoteSendBodySchema.parse({
        note: "hello",
        recipientMembershipIds: ["mem-1"],
      }),
    ).toEqual({ note: "hello", recipientMembershipIds: ["mem-1"] });
    expect(adminNoteSendBodySchema.safeParse({ note: "hello" }).success).toBe(false);
  });
});

describe("parseAdminNoteBody", () => {
  it("reads JSON notes", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "  Kickoff moved  " }),
    });
    await expect(parseAdminNoteBody(request)).resolves.toEqual({
      ok: true,
      note: "Kickoff moved",
    });
  });

  it("reads form-urlencoded notes for preview", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "note=Line%20one",
    });
    await expect(parseAdminNoteBody(request)).resolves.toEqual({
      ok: true,
      note: "Line one",
    });
  });

  it("returns VALIDATION-style failure for whitespace JSON", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "   " }),
    });
    await expect(parseAdminNoteBody(request)).resolves.toMatchObject({ ok: false });
  });
});

describe("parseAdminNoteSendBody", () => {
  it("reads JSON note and recipient ids", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        note: "  Kickoff moved  ",
        recipientMembershipIds: ["mem-1", "mem-2"],
      }),
    });
    await expect(parseAdminNoteSendBody(request)).resolves.toEqual({
      ok: true,
      note: "Kickoff moved",
      recipientMembershipIds: ["mem-1", "mem-2"],
    });
  });

  it("fails when recipientMembershipIds is missing", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "Kickoff moved" }),
    });
    await expect(parseAdminNoteSendBody(request)).resolves.toEqual({
      ok: false,
      message: "Select at least one recipient",
    });
  });
});
