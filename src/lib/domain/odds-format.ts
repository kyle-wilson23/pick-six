/** Leftover American moneylines are integers at or beyond even money. */
export function isAmericanMoneyline(n: number): boolean {
  return n <= -100 || n >= 100;
}

export function americanToDecimal(american: number): number {
  if (american === 0) {
    return Number.NaN;
  }
  if (american > 0) {
    return american / 100 + 1;
  }
  return 100 / Math.abs(american) + 1;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Mixed-era moneyline → European decimal, or `null` if the value cannot be used
 * for ranking/display (NaN, 0, or other non-American junk outside `(1, 100)`).
 */
export function normalizeMoneylineToDecimal(n: number): number | null {
  if (!Number.isFinite(n)) {
    return null;
  }
  if (isAmericanMoneyline(n)) {
    const dec = americanToDecimal(n);
    return Number.isFinite(dec) ? round3(dec) : null;
  }
  if (n <= 1 || n >= 100) {
    return null;
  }
  return round3(n);
}

/** Two-decimal European display. Leftover American values are converted first. */
export function formatDecimalMoneyline(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "–";
  }
  const dec = normalizeMoneylineToDecimal(value);
  if (dec === null) {
    return "–";
  }
  return dec.toFixed(2);
}

export type ManualMoneylineValidation =
  | { ok: true }
  | { ok: false; code: "AMERICAN_MONEYLINE_NOT_ALLOWED" | "VALIDATION_ERROR"; message: string };

export function validateManualMoneyline(n: number | null): ManualMoneylineValidation {
  if (n === null) {
    return { ok: true };
  }
  if (!Number.isFinite(n)) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Invalid moneyline" };
  }
  if (isAmericanMoneyline(n)) {
    return {
      ok: false,
      code: "AMERICAN_MONEYLINE_NOT_ALLOWED",
      message: "Enter European decimal moneylines (e.g. 1.91), not American odds.",
    };
  }
  if (n <= 1 || n >= 100) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Moneyline must be European decimal odds greater than 1.",
    };
  }
  return { ok: true };
}

export function validateManualMoneylines(
  home: number | null,
  away: number | null,
): ManualMoneylineValidation {
  const h = validateManualMoneyline(home);
  if (!h.ok) {
    return h;
  }
  return validateManualMoneyline(away);
}
