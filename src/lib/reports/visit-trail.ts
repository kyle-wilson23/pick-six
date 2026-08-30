export const VISIT_TRAIL_MAX = 15;
export const VISIT_TRAIL_STORAGE_KEY = "pick-six:visit-trail";

export function stripPathname(pathname: string): string {
  const noHash = pathname.split("#")[0] ?? pathname;
  const noQuery = noHash.split("?")[0] ?? noHash;
  const trimmed = noQuery.trim();
  if (!trimmed) {
    return "/";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** Collapse consecutive duplicate pathnames; keep the last `VISIT_TRAIL_MAX`. */
export function appendVisitPath(trail: readonly string[], pathname: string): string[] {
  const path = stripPathname(pathname);
  if (trail.at(-1) === path) {
    return [...trail];
  }
  const next = [...trail, path];
  return next.length > VISIT_TRAIL_MAX ? next.slice(-VISIT_TRAIL_MAX) : next;
}

export function parseStoredVisitTrail(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .map(stripPathname)
      .slice(-VISIT_TRAIL_MAX);
  } catch {
    return [];
  }
}

type TrailStorage = Pick<Storage, "getItem" | "setItem">;

export function readVisitTrail(storage: TrailStorage): string[] {
  return parseStoredVisitTrail(storage.getItem(VISIT_TRAIL_STORAGE_KEY));
}

export function recordVisitTrail(pathname: string, storage: TrailStorage): string[] {
  const next = appendVisitPath(readVisitTrail(storage), pathname);
  storage.setItem(VISIT_TRAIL_STORAGE_KEY, JSON.stringify(next));
  return next;
}
