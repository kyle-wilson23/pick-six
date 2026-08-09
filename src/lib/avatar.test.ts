import { describe, expect, it } from "vitest";

import {
  AVATAR_BAD_TYPE_MESSAGE,
  AVATAR_EMPTY_MESSAGE,
  AVATAR_MAX_BYTES,
  AVATAR_TOO_LARGE_MESSAGE,
  isVercelBlobUrl,
  sniffAvatarMime,
  userInitials,
  validateAvatarFile,
} from "@/lib/avatar";

describe("userInitials", () => {
  it("uses first letters of two+ word names", () => {
    expect(userInitials("Kyle Wilson")).toBe("KW");
  });

  it("uses first two chars for a single token", () => {
    expect(userInitials("kyle@example.com")).toBe("KY");
  });

  it("returns ? for blank", () => {
    expect(userInitials("   ")).toBe("?");
  });
});

describe("validateAvatarFile", () => {
  it("accepts allowed mime within size", () => {
    expect(
      validateAvatarFile({ mime: "image/jpeg", size: 1024 }),
    ).toEqual({ ok: true, mime: "image/jpeg" });
  });

  it("rejects oversized files", () => {
    const result = validateAvatarFile({
      mime: "image/png",
      size: AVATAR_MAX_BYTES + 1,
    });
    expect(result).toEqual({
      ok: false,
      code: "TOO_LARGE",
      message: AVATAR_TOO_LARGE_MESSAGE,
    });
  });

  it("rejects empty files with a distinct message", () => {
    const result = validateAvatarFile({ mime: "image/png", size: 0 });
    expect(result).toEqual({
      ok: false,
      code: "TOO_LARGE",
      message: AVATAR_EMPTY_MESSAGE,
    });
  });

  it("rejects disallowed types", () => {
    const result = validateAvatarFile({ mime: "image/gif", size: 100 });
    expect(result).toEqual({
      ok: false,
      code: "BAD_TYPE",
      message: AVATAR_BAD_TYPE_MESSAGE,
    });
  });
});

describe("isVercelBlobUrl", () => {
  it("accepts public blob hosts", () => {
    expect(
      isVercelBlobUrl("https://abc.public.blob.vercel-storage.com/x.jpg"),
    ).toBe(true);
  });

  it("rejects unrelated hosts", () => {
    expect(isVercelBlobUrl("https://example.com/x.jpg")).toBe(false);
  });
});

describe("sniffAvatarMime", () => {
  it("detects jpeg", () => {
    expect(sniffAvatarMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg",
    );
  });

  it("detects png", () => {
    expect(
      sniffAvatarMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])),
    ).toBe("image/png");
  });

  it("returns null for unknown", () => {
    expect(sniffAvatarMime(new Uint8Array([0, 1, 2, 3]))).toBeNull();
  });
});
