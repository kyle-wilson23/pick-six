import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { commentarySpend, parseCommentaryPrice, readCommentaryConfig } from "./config";

const COMPLETE = {
  COMMENTARY_API_KEY: "secret-key",
  COMMENTARY_MODEL_ID: "provider/model",
  COMMENTARY_INPUT_USD_PER_MILLION: "3",
  COMMENTARY_OUTPUT_USD_PER_MILLION: "15",
};

describe("readCommentaryConfig", () => {
  it("reads the four server values", () => {
    expect(readCommentaryConfig(COMPLETE)).toEqual({
      apiKey: "secret-key",
      modelId: "provider/model",
      inputUsdPerMillion: 3,
      outputUsdPerMillion: 15,
    });
  });

  it("returns null when a value is missing or a price is not a finite number >= 0", () => {
    expect(readCommentaryConfig({ ...COMPLETE, COMMENTARY_API_KEY: "  " })).toBeNull();
    expect(readCommentaryConfig({ ...COMPLETE, COMMENTARY_MODEL_ID: undefined })).toBeNull();
    expect(readCommentaryConfig({ ...COMPLETE, COMMENTARY_INPUT_USD_PER_MILLION: "nope" })).toBeNull();
    expect(readCommentaryConfig({ ...COMPLETE, COMMENTARY_OUTPUT_USD_PER_MILLION: "-1" })).toBeNull();
    expect(readCommentaryConfig({ ...COMPLETE, COMMENTARY_INPUT_USD_PER_MILLION: "Infinity" })).toBeNull();
    expect(readCommentaryConfig({ ...COMPLETE, COMMENTARY_OUTPUT_USD_PER_MILLION: "" })).toBeNull();
    expect(parseCommentaryPrice("0")).toBe(0);
    expect(parseCommentaryPrice("1.5")).toBe(1.5);
  });
});

describe("commentarySpend", () => {
  it("computes decimal dollars from tokens and the price per million", () => {
    const spend = commentarySpend({
      inputTokens: 100,
      outputTokens: 50,
      inputUsdPerMillion: 3,
      outputUsdPerMillion: 15,
    });
    expect(spend.equals(new Prisma.Decimal("0.00105"))).toBe(true);
  });
});
