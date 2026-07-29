"use client";

import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const NAV_LOADING_TIMEOUT_MS = 8_000;

/** Returns true when href is same-origin in-app navigation to a different URL. */
export function isInternalAppNavigationHref(
  href: string,
  pathname: string,
  search: string,
): boolean {
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) {
      return false;
    }
    return url.pathname + url.search !== pathname + search;
  } catch {
    return false;
  }
}

type NavRequest = {
  from: string;
  to: string;
};

function NavigationLoadingIndicatorInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentSearch = search ? `?${search}` : "";
  const currentUrl = pathname + currentSearch;
  const [navRequest, setNavRequest] = useState<NavRequest | null>(null);

  const isNavigating =
    navRequest !== null &&
    currentUrl === navRequest.from &&
    navRequest.to !== navRequest.from;

  useEffect(() => {
    setNavRequest(null);
  }, [pathname, search]);

  useEffect(() => {
    const clearNavRequest = () => {
      setNavRequest(null);
    };

    window.addEventListener("popstate", clearNavRequest);
    return () => window.removeEventListener("popstate", clearNavRequest);
  }, []);

  useEffect(() => {
    if (!isNavigating) return;
    const timeout = window.setTimeout(() => {
      setNavRequest(null);
    }, NAV_LOADING_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [isNavigating]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      if (!isInternalAppNavigationHref(href, pathname, currentSearch)) {
        return;
      }

      const url = new URL(href, window.location.origin);
      const destination = url.pathname + url.search;
      setNavRequest({ from: currentUrl, to: destination });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, currentSearch, currentUrl]);

  if (!isNavigating) {
    return null;
  }

  return (
    <Stack
      aria-busy="true"
      aria-live="polite"
      alignItems="center"
      justifyContent="center"
      spacing={2}
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        bgcolor: (theme) => `${theme.palette.background.default}E6`,
      }}
    >
      <CircularProgress color="primary" aria-hidden />
      <Typography variant="body2" color="text.secondary">
        Loading…
      </Typography>
    </Stack>
  );
}

export function NavigationLoadingIndicator() {
  return (
    <Suspense fallback={null}>
      <NavigationLoadingIndicatorInner />
    </Suspense>
  );
}
