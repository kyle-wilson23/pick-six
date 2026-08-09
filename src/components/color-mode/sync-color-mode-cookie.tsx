"use client";

import { useEffect } from "react";

import {
  applyColorModeToDocument,
  type ColorMode,
  readColorModeCookieFromDocument,
  writeColorModeCookie,
} from "@/lib/color-mode";

/**
 * When the server resolved a different mode than the guest cookie (typically
 * authenticated DB preference), align the cookie. Skip if already matching so
 * we do not clobber a newer client-only toggle during remount races.
 */
export function SyncColorModeCookie({ mode }: { mode: ColorMode }) {
  useEffect(() => {
    const live = readColorModeCookieFromDocument();
    if (live === mode) {
      applyColorModeToDocument(mode);
      return;
    }
    writeColorModeCookie(mode);
    applyColorModeToDocument(mode);
  }, [mode]);

  return null;
}
