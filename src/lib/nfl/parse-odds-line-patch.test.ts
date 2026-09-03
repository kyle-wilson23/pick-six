import { describe, expect, it } from "vitest";

import { parseOddsLinePatchBody } from "./parse-odds-line-patch";

describe("parseOddsLinePatchBody", () => {
  it("accepts European decimal moneylines", () => {
    const parsed = parseOddsLinePatchBody({
      homeMoneylineAmerican: 1.91,
      awayMoneylineAmerican: 2.1,
      homeSpreadPoints: -3.5,
    });
    expect(parsed).toEqual({
      ok: true,
      data: {
        homeMoneylineAmerican: 1.91,
        awayMoneylineAmerican: 2.1,
        homeSpreadPoints: -3.5,
      },
    });
  });

  it("rejects American-looking moneylines with AMERICAN_MONEYLINE_NOT_ALLOWED", () => {
    expect(
      parseOddsLinePatchBody({
        homeMoneylineAmerican: -150,
        awayMoneylineAmerican: 2.1,
        homeSpreadPoints: -3,
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "AMERICAN_MONEYLINE_NOT_ALLOWED",
        message: "Enter European decimal moneylines (e.g. 1.91), not American odds.",
      },
    });
    expect(
      parseOddsLinePatchBody({
        homeMoneylineAmerican: 1.91,
        awayMoneylineAmerican: 130,
        homeSpreadPoints: -3,
      }).ok,
    ).toBe(false);
  });
});
