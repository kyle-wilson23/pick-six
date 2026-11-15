import { Prisma } from "@prisma/client";

import type { CommentaryPrices } from "./commentary-config";

const MILLION = new Prisma.Decimal(1_000_000);

export type CallTokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

/** Dollar spend for one model call. A non-call (`null` usage) adds nothing. */
export function addCallSpend(
  current: Prisma.Decimal,
  usage: CallTokenUsage | null,
  prices: CommentaryPrices,
): Prisma.Decimal {
  if (usage == null) return current;
  const input = new Prisma.Decimal(usage.inputTokens).div(MILLION).mul(prices.inputUsdPerMillion);
  const output = new Prisma.Decimal(usage.outputTokens)
    .div(MILLION)
    .mul(prices.outputUsdPerMillion);
  return current.add(input).add(output);
}
