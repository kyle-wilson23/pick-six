import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { apiSportsGamesEnvelopeSchema } from "./schemas";

const here = dirname(fileURLToPath(import.meta.url));

describe("apiSportsGamesEnvelopeSchema", () => {
  it("parses recorded fixture (no network)", () => {
    const raw = readFileSync(join(here, "fixtures", "games-regular-season-sample.json"), "utf8");
    const json: unknown = JSON.parse(raw);
    const parsed = apiSportsGamesEnvelopeSchema.safeParse(json);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.response.length).toBe(3);
    expect(parsed.data.response[0]?.game.id).toBe(10001);
  });
});
