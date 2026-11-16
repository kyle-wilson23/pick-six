import "server-only";

import { Prisma } from "@prisma/client";

/** Documented $1 default for `League.commentaryWeeklyCeilingUsd`. Runs read the league column. */
export const COMMENTARY_CEILING_USD = new Prisma.Decimal(1);

const MODEL_ID = "COMMENTARY_MODEL_ID";
const GATEWAY_KEY = "AI_GATEWAY_API_KEY";
const INPUT_PRICE = "COMMENTARY_INPUT_USD_PER_MILLION";
const OUTPUT_PRICE = "COMMENTARY_OUTPUT_USD_PER_MILLION";

export type CommentaryPrices = {
  inputUsdPerMillion: Prisma.Decimal;
  outputUsdPerMillion: Prisma.Decimal;
};

export type CommentaryConfig =
  | ({
      callable: true;
      modelId: string;
    } & CommentaryPrices)
  | {
      callable: false;
      stopReason: string;
    };

function parseUsdPerMillion(raw: string | undefined): Prisma.Decimal | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  try {
    const price = new Prisma.Decimal(trimmed);
    if (!price.isFinite()) return null;
    return price;
  } catch {
    return null;
  }
}

export function readCommentaryConfig(
  env: Record<string, string | undefined> = process.env,
): CommentaryConfig {
  const modelId = env[MODEL_ID]?.trim() ?? "";
  if (modelId === "") {
    return { callable: false, stopReason: `missing ${MODEL_ID}` };
  }
  const apiKey = env[GATEWAY_KEY]?.trim() ?? "";
  if (apiKey === "") {
    return { callable: false, stopReason: `missing ${GATEWAY_KEY}` };
  }
  const inputUsdPerMillion = parseUsdPerMillion(env[INPUT_PRICE]);
  if (inputUsdPerMillion == null) {
    return { callable: false, stopReason: `missing or non-numeric ${INPUT_PRICE}` };
  }
  const outputUsdPerMillion = parseUsdPerMillion(env[OUTPUT_PRICE]);
  if (outputUsdPerMillion == null) {
    return { callable: false, stopReason: `missing or non-numeric ${OUTPUT_PRICE}` };
  }
  return {
    callable: true,
    modelId,
    inputUsdPerMillion,
    outputUsdPerMillion,
  };
}
