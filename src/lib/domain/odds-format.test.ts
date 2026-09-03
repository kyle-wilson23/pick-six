import { describe, expect, it } from "vitest";

import {
  americanToDecimal,
  formatDecimalMoneyline,
  isAmericanMoneyline,
  normalizeMoneylineToDecimal,
  validateManualMoneyline,
  validateManualMoneylines,
} from "./odds-format";

describe("isAmericanMoneyline", () => {
  it("treats even-money and beyond as American", () => {
    expect(isAmericanMoneyline(-100)).toBe(true);
    expect(isAmericanMoneyline(100)).toBe(true);
    expect(isAmericanMoneyline(-150)).toBe(true);
    expect(isAmericanMoneyline(130)).toBe(true);
  });

  it("does not treat European decimals as American", () => {
    expect(isAmericanMoneyline(1.91)).toBe(false);
    expect(isAmericanMoneyline(2.3)).toBe(false);
    expect(isAmericanMoneyline(1.25)).toBe(false);
  });
});

describe("americanToDecimal", () => {
  it("converts the spec examples", () => {
    expect(americanToDecimal(-150)).toBeCloseTo(1.6667, 4);
    expect(americanToDecimal(130)).toBeCloseTo(2.3, 5);
    expect(americanToDecimal(-400)).toBeCloseTo(1.25, 5);
  });
});

describe("normalizeMoneylineToDecimal", () => {
  it("converts leftover American and passes through decimal", () => {
    expect(normalizeMoneylineToDecimal(-150)).toBe(1.667);
    expect(normalizeMoneylineToDecimal(130)).toBe(2.3);
    expect(normalizeMoneylineToDecimal(-1200)).toBe(1.083);
    expect(normalizeMoneylineToDecimal(1.91)).toBe(1.91);
    expect(normalizeMoneylineToDecimal(1.25)).toBe(1.25);
  });

  it("returns null for unnormalizable values", () => {
    expect(normalizeMoneylineToDecimal(0)).toBeNull();
    expect(normalizeMoneylineToDecimal(1)).toBeNull();
    expect(normalizeMoneylineToDecimal(Number.NaN)).toBeNull();
  });
});

describe("formatDecimalMoneyline", () => {
  it("formats leftover American and new decimal to two places without a + prefix", () => {
    expect(formatDecimalMoneyline(-150)).toBe("1.67");
    expect(formatDecimalMoneyline(130)).toBe("2.30");
    expect(formatDecimalMoneyline(1.91)).toBe("1.91");
    expect(formatDecimalMoneyline(1.25)).toBe("1.25");
    expect(formatDecimalMoneyline(null)).toBe("–");
  });
});

describe("validateManualMoneyline", () => {
  it("accepts decimal and null", () => {
    expect(validateManualMoneyline(1.91)).toEqual({ ok: true });
    expect(validateManualMoneyline(2.1)).toEqual({ ok: true });
    expect(validateManualMoneyline(null)).toEqual({ ok: true });
  });

  it("rejects American-looking values", () => {
    expect(validateManualMoneyline(-150)).toEqual({
      ok: false,
      code: "AMERICAN_MONEYLINE_NOT_ALLOWED",
      message: "Enter European decimal moneylines (e.g. 1.91), not American odds.",
    });
    expect(validateManualMoneyline(130)).toMatchObject({
      ok: false,
      code: "AMERICAN_MONEYLINE_NOT_ALLOWED",
    });
  });
});

describe("validateManualMoneylines", () => {
  it("accepts a decimal pair and rejects when either side is American", () => {
    expect(validateManualMoneylines(1.91, 2.1)).toEqual({ ok: true });
    expect(validateManualMoneylines(-150, 2.1).ok).toBe(false);
    expect(validateManualMoneylines(1.91, 130).ok).toBe(false);
  });
});
