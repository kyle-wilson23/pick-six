import { Prisma } from "@prisma/client";
import { z } from "zod";

const CEILING_PATTERN = /^\d+(\.\d+)?$/;
const CEILING_LIMIT = new Prisma.Decimal(1_000_000);

/**
 * Canonical non-negative `Decimal(12, 6)` string, or null when the value does not fit.
 * Trailing zeros collapse, so `"2.50"` stores as `"2.5"`.
 */
export function storedCommentaryCeilingUsd(raw: string): string | null {
  const trimmed = raw.trim();
  if (!CEILING_PATTERN.test(trimmed)) return null;
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(trimmed);
  } catch {
    return null;
  }
  if (!decimal.isFinite() || decimal.isNegative()) return null;
  if (decimal.decimalPlaces() > 6) return null;
  if (!decimal.lessThan(CEILING_LIMIT)) return null;
  const stored = decimal.toString();
  if (!CEILING_PATTERN.test(stored)) return null;
  return stored;
}

/** PATCH `/api/leagues/[leagueId]/commentary-ceiling` JSON body (Story 10.3). */
export const patchCommentaryCeilingBodySchema = z
  .object({
    commentaryWeeklyCeilingUsd: z.string().trim().transform((value, ctx) => {
      const stored = storedCommentaryCeilingUsd(value);
      if (stored == null) {
        ctx.addIssue({ code: "custom", message: "Invalid weekly dollar ceiling" });
        return z.NEVER;
      }
      return stored;
    }),
  })
  .strict();

export type PatchCommentaryCeilingBody = z.infer<typeof patchCommentaryCeilingBodySchema>;
