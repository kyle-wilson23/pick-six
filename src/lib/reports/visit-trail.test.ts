import { describe, expect, it } from "vitest";

import {
  VISIT_TRAIL_MAX,
  VISIT_TRAIL_STORAGE_KEY,
  appendVisitPath,
  parseStoredVisitTrail,
  recordVisitTrail,
  stripPathname,
} from "./visit-trail";

describe("stripPathname", () => {
  it("strips query and hash", () => {
    expect(stripPathname("/leagues/abc/picks?x=1#top")).toBe("/leagues/abc/picks");
  });

  it("returns / for empty", () => {
    expect(stripPathname("")).toBe("/");
    expect(stripPathname("   ")).toBe("/");
  });
});

describe("appendVisitPath", () => {
  it("collapses consecutive duplicates", () => {
    expect(appendVisitPath(["/home"], "/home")).toEqual(["/home"]);
  });

  it("keeps non-consecutive repeats", () => {
    expect(appendVisitPath(["/home", "/profile"], "/home")).toEqual([
      "/home",
      "/profile",
      "/home",
    ]);
  });

  it("caps at last 15", () => {
    const trail = Array.from({ length: VISIT_TRAIL_MAX }, (_, i) => `/p${i}`);
    const next = appendVisitPath(trail, "/new");
    expect(next).toHaveLength(VISIT_TRAIL_MAX);
    expect(next[0]).toBe("/p1");
    expect(next.at(-1)).toBe("/new");
  });
});

describe("parseStoredVisitTrail", () => {
  it("returns empty for invalid JSON", () => {
    expect(parseStoredVisitTrail("not-json")).toEqual([]);
    expect(parseStoredVisitTrail(null)).toEqual([]);
  });
});

describe("recordVisitTrail", () => {
  it("reads and writes session-like storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    recordVisitTrail("/home", storage);
    recordVisitTrail("/home", storage);
    recordVisitTrail("/profile", storage);
    expect(JSON.parse(store.get(VISIT_TRAIL_STORAGE_KEY) ?? "[]")).toEqual([
      "/home",
      "/profile",
    ]);
  });
});
