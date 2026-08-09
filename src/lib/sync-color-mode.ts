import type { ColorMode } from "@/lib/color-mode";

/**
 * Persist color mode for the authenticated user after sign-in.
 * Failures are ignored so login/signup is never blocked.
 */
export async function syncColorModeAfterAuth(mode: ColorMode): Promise<void> {
  try {
    await fetch("/api/profile/color-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colorMode: mode }),
    });
  } catch {
    /* do not block auth */
  }
}
