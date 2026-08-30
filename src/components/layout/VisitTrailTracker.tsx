"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { recordVisitTrail } from "@/lib/reports/visit-trail";

export function VisitTrailTracker() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      recordVisitTrail(pathname, sessionStorage);
    } catch {
      // sessionStorage can throw in private mode; trail is best-effort.
    }
  }, [pathname]);

  return null;
}
