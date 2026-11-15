import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { COMMENTARY_CEILING_USD, readCommentaryConfig } from "./commentary-config";

const CALLABLE = {
  COMMENTARY_MODEL_ID: "test/model",
  AI_GATEWAY_API_KEY: "gateway-key",
  COMMENTARY_INPUT_USD_PER_MILLION: "1.5",
  COMMENTARY_OUTPUT_USD_PER_MILLION: "6",
};

describe("readCommentaryConfig", () => {
  it("is callable when the model id, gateway key, and both prices are set", () => {
    const config = readCommentaryConfig(CALLABLE);
    expect(config.callable).toBe(true);
    if (!config.callable) return;
    expect(config.modelId).toBe("test/model");
    expect(config.inputUsdPerMillion.equals("1.5")).toBe(true);
    expect(config.outputUsdPerMillion.equals("6")).toBe(true);
    expect(config.ceilingUsd.equals(COMMENTARY_CEILING_USD)).toBe(true);
    expect(config.ceilingUsd.equals(new Prisma.Decimal(1))).toBe(true);
    expect(config).not.toHaveProperty("apiKey");
    expect(config).not.toHaveProperty("AI_GATEWAY_API_KEY");
  });

  it("trims a numeric price", () => {
    const config = readCommentaryConfig({
      ...CALLABLE,
      COMMENTARY_INPUT_USD_PER_MILLION: "  0.25  ",
    });
    expect(config.callable).toBe(true);
    if (!config.callable) return;
    expect(config.inputUsdPerMillion.equals("0.25")).toBe(true);
  });

  it.each([
    ["COMMENTARY_MODEL_ID", "missing COMMENTARY_MODEL_ID"],
    ["AI_GATEWAY_API_KEY", "missing AI_GATEWAY_API_KEY"],
    ["COMMENTARY_INPUT_USD_PER_MILLION", "missing or non-numeric COMMENTARY_INPUT_USD_PER_MILLION"],
    [
      "COMMENTARY_OUTPUT_USD_PER_MILLION",
      "missing or non-numeric COMMENTARY_OUTPUT_USD_PER_MILLION",
    ],
  ] as const)("is not callable when %s is missing", (key, stopReason) => {
    const env = { ...CALLABLE, [key]: "   " };
    expect(readCommentaryConfig(env)).toEqual({ callable: false, stopReason });
  });

  it("is not callable when a price is non-numeric", () => {
    expect(
      readCommentaryConfig({
        ...CALLABLE,
        COMMENTARY_OUTPUT_USD_PER_MILLION: "abc",
      }),
    ).toEqual({
      callable: false,
      stopReason: "missing or non-numeric COMMENTARY_OUTPUT_USD_PER_MILLION",
    });
    expect(
      readCommentaryConfig({
        ...CALLABLE,
        COMMENTARY_INPUT_USD_PER_MILLION: "-1",
      }).callable,
    ).toBe(false);
  });
});
