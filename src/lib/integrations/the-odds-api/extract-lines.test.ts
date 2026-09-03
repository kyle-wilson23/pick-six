import { describe, expect, it } from "vitest";

import { extractLineFromTheOddsApiEvent } from "./extract-lines";
import { theOddsApiEventSchema } from "./schemas";

import sample from "./fixtures/nfl-odds-sample.json";

describe("extractLineFromTheOddsApiEvent", () => {
  it("reads h2h and home spread from first bookmaker", () => {
    const event = theOddsApiEventSchema.parse(sample[0]);
    const line = extractLineFromTheOddsApiEvent(event);
    expect(line.homeMoneylineAmerican).toBe(1.4);
    expect(line.awayMoneylineAmerican).toBe(3.1);
    expect(line.homeSpreadPoints).toBe(-7.5);
  });
});
