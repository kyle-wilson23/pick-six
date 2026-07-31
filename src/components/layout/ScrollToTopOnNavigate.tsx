"use client";

import { Suspense, useEffect, useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function resetScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

/** Clear incidental App Router focus on `#main-content`; keep skip-link / keyboard focus. */
function blurMainIfIncidentalFocus() {
  const main = document.getElementById("main-content");
  if (!(main instanceof HTMLElement) || document.activeElement !== main) return;
  if (main.matches(":focus-visible")) return;
  main.blur();
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
    blurMainIfIncidentalFocus();
  }, [pathname, search]);

  // Next's ScrollAndFocusHandler focuses the segment after our layout effect.
  useEffect(() => {
    resetScroll();
    blurMainIfIncidentalFocus();

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      // Only the landmark itself — not controls inside main (avoids yanking scroll on tab).
      if (target.id !== "main-content") return;
      resetScroll();
      blurMainIfIncidentalFocus();
    };
    document.addEventListener("focusin", onFocusIn, true);
    const done = window.setTimeout(() => {
      document.removeEventListener("focusin", onFocusIn, true);
    }, 250);

    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      window.clearTimeout(done);
    };
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
