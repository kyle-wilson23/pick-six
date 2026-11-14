import "server-only";

import { Prisma } from "@prisma/client";

export type CommentaryConfig = {
  apiKey: string;
  modelId: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

const DECIMAL_PRICE = /^[+]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function requiredText(value: string | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Finite decimal price `>= 0`, or null when the env value is missing or not that number. */
export function parseCommentaryPrice(value: string | undefined): number | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "" || !DECIMAL_PRICE.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

/** The four server env values, or null when any is missing or a price is not a finite number `>= 0`. */
export function readCommentaryConfig(
  env: Record<string, string | undefined> = process.env,
): CommentaryConfig | null {
  const apiKey = requiredText(env.COMMENTARY_API_KEY);
  const modelId = requiredText(env.COMMENTARY_MODEL_ID);
  const inputUsdPerMillion = parseCommentaryPrice(env.COMMENTARY_INPUT_USD_PER_MILLION);
  const outputUsdPerMillion = parseCommentaryPrice(env.COMMENTARY_OUTPUT_USD_PER_MILLION);
  if (
    apiKey == null ||
    modelId == null ||
    inputUsdPerMillion == null ||
    outputUsdPerMillion == null
  ) {
    return null;
  }
  return { apiKey, modelId, inputUsdPerMillion, outputUsdPerMillion };
}

/** Decimal dollars: tokens / 1_000_000 times the configured price per million. */
export function commentarySpend(args: {
  inputTokens: number;
  outputTokens: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}): Prisma.Decimal {
  const input = new Prisma.Decimal(args.inputTokens)
    .div(1_000_000)
    .mul(new Prisma.Decimal(args.inputUsdPerMillion));
  const output = new Prisma.Decimal(args.outputTokens)
    .div(1_000_000)
    .mul(new Prisma.Decimal(args.outputUsdPerMillion));
  return input.add(output);
}
