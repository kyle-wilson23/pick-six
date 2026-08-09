import { z } from "zod";

/** Guest + API contract — lowercase wire values. */
export const colorModeSchema = z.enum(["dark", "light"]);

export type ColorMode = z.infer<typeof colorModeSchema>;

export const DEFAULT_COLOR_MODE: ColorMode = "dark";

export const COLOR_MODE_COOKIE_NAME = "color-mode";

/** 1 year — guest preference across auth screens. */
export const COLOR_MODE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const updateColorModeBodySchema = z.object({
  colorMode: colorModeSchema,
});

export function parseColorMode(value: unknown): ColorMode {
  const parsed = colorModeSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_COLOR_MODE;
}

/** Prisma `ColorMode` enum → API/UI wire value. */
export function colorModeFromPrisma(value: "DARK" | "LIGHT" | null | undefined): ColorMode {
  if (value === "LIGHT") return "light";
  return "dark";
}

/** API/UI wire value → Prisma `ColorMode` enum. */
export function colorModeToPrisma(value: ColorMode): "DARK" | "LIGHT" {
  return value === "light" ? "LIGHT" : "DARK";
}

export function colorModeCookieHeader(mode: ColorMode, secure = false): string {
  const parts = [
    `${COLOR_MODE_COOKIE_NAME}=${mode}`,
    "Path=/",
    `Max-Age=${COLOR_MODE_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

/** Client-side guest / optimistic cookie write. */
export function writeColorModeCookie(mode: ColorMode): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = colorModeCookieHeader(mode, secure);
}

export function readColorModeCookieFromDocument(): ColorMode {
  if (typeof document === "undefined") return DEFAULT_COLOR_MODE;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COLOR_MODE_COOKIE_NAME}=`));
  if (!match) return DEFAULT_COLOR_MODE;
  return parseColorMode(match.split("=")[1]);
}

export function applyColorModeToDocument(mode: ColorMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.colorMode = mode;
  document.documentElement.style.colorScheme = mode;
}
