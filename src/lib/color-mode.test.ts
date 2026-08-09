import { describe, expect, it } from "vitest";

import {
  DEFAULT_COLOR_MODE,
  colorModeCookieHeader,
  colorModeFromPrisma,
  colorModeToPrisma,
  parseColorMode,
  updateColorModeBodySchema,
} from "@/lib/color-mode";

describe("parseColorMode", () => {
  it("defaults when unset or invalid", () => {
    expect(parseColorMode(undefined)).toBe(DEFAULT_COLOR_MODE);
    expect(parseColorMode(null)).toBe("dark");
    expect(parseColorMode("")).toBe("dark");
    expect(parseColorMode("system")).toBe("dark");
    expect(parseColorMode("DARK")).toBe("dark");
  });

  it("accepts wire values", () => {
    expect(parseColorMode("dark")).toBe("dark");
    expect(parseColorMode("light")).toBe("light");
  });
});

describe("prisma mapping", () => {
  it("maps both directions", () => {
    expect(colorModeFromPrisma("DARK")).toBe("dark");
    expect(colorModeFromPrisma("LIGHT")).toBe("light");
    expect(colorModeFromPrisma(undefined)).toBe("dark");
    expect(colorModeToPrisma("dark")).toBe("DARK");
    expect(colorModeToPrisma("light")).toBe("LIGHT");
  });
});

describe("updateColorModeBodySchema", () => {
  it("accepts valid write-through payloads", () => {
    expect(updateColorModeBodySchema.parse({ colorMode: "light" })).toEqual({
      colorMode: "light",
    });
    expect(updateColorModeBodySchema.parse({ colorMode: "dark" })).toEqual({
      colorMode: "dark",
    });
  });

  it("rejects invalid colorMode", () => {
    expect(updateColorModeBodySchema.safeParse({ colorMode: "system" }).success).toBe(
      false,
    );
    expect(updateColorModeBodySchema.safeParse({}).success).toBe(false);
  });
});

describe("colorModeCookieHeader", () => {
  it("sets path, max-age, and samesite", () => {
    const header = colorModeCookieHeader("light");
    expect(header).toContain("color-mode=light");
    expect(header).toContain("Path=/");
    expect(header).toContain("Max-Age=");
    expect(header).toContain("SameSite=Lax");
    expect(header).not.toContain("Secure");
  });

  it("adds Secure when requested", () => {
    expect(colorModeCookieHeader("dark", true)).toContain("Secure");
  });
});
