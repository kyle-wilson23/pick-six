"use client";

import { Suspense, useEffect, useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function resetScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  const main = document.getElementById("main-content");
  if (main instanceof HTMLElement && document.activeElement === main) {
    main.blur();
  }
}

function ScrollToTopOnNavigateInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useLayoutEffect(() => {
    if (typeof history !== "undefined") {
      history.scrollRestoration = "manual";
    }
  }, []);

  useLayoutEffect(() => {
    resetScroll();
    const frame = requestAnimationFrame(resetScroll);
    return () => cancelAnimationFrame(frame);
  }, [pathname, search]);

  // After paint — beats App Router restoring scroll from the previous route (e.g. login).
  useEffect(() => {
    resetScroll();
    const timeout = window.setTimeout(resetScroll, 0);
    return () => window.clearTimeout(timeout);
  }, [pathname, search]);

  return null;
}

/** Resets scroll position on client navigations (Story 9.5 — fixed AppBar layouts). */
export function ScrollToTopOnNavigate() {
  return (
    <Suspense fallback={null}>
      <ScrollToTopOnNavigateInner />
    </Suspense>
  );
}
