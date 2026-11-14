import "server-only";

import { createGateway, generateText, NoObjectGeneratedError, Output } from "ai";
import { Prisma } from "@prisma/client";

import { commentarySpend, readCommentaryConfig, type CommentaryConfig } from "@/lib/commentary/config";
import {
  commentaryLineSchema,
  keepCheckedLines,
  outcomeTextForKeptLines,
  parseCommentaryLines,
  type CommentaryLine,
} from "@/lib/commentary/lines";
import { linkLeaguePersons } from "@/lib/commentary/persons";
import { buildCommentaryView, loadFreshPickCells, type CommentaryViewEntry } from "@/lib/commentary/view";
import { prisma } from "@/lib/db";

export const COMMENTARY_STOP_MISSING_PRICE = "missing_price";
export const COMMENTARY_STOP_MODEL_ERROR = "model_error";

type RunKey = {
  leagueId: string;
  nflSeasonYear: number;
  weekNumber: number;
};

type StoredRun = {
  id: string;
  status: "PENDING" | "SETTLED" | "ABNORMAL";
  outcomeText: string | null;
};

export type WeeklyCommentaryResult = {
  outcomeText: string | null;
};

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === "P2002";
}

function settledText(row: StoredRun | null): string | null {
  if (row?.status !== "SETTLED") {
    return null;
  }
  return row.outcomeText;
}

function reportedTokenUsage(source: unknown): { inputTokens: number; outputTokens: number } | null {
  if (!source || typeof source !== "object") {
    return null;
  }
  const usage =
    "usage" in source && source.usage && typeof source.usage === "object" ? source.usage : source;
  if (!usage || typeof usage !== "object") {
    return null;
  }
  const input = "inputTokens" in usage ? usage.inputTokens : undefined;
  const output = "outputTokens" in usage ? usage.outputTokens : undefined;
  if (typeof input !== "number" && typeof output !== "number") {
    return null;
  }
  const inputTokens = typeof input === "number" && Number.isFinite(input) && input >= 0 ? input : 0;
  const outputTokens =
    typeof output === "number" && Number.isFinite(output) && output >= 0 ? output : 0;
  return { inputTokens, outputTokens };
}

function spendFor(
  usage: { inputTokens: number; outputTokens: number } | null,
  config: CommentaryConfig | null,
): Prisma.Decimal {
  if (!usage || !config) {
    return new Prisma.Decimal(0);
  }
  return commentarySpend({
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    inputUsdPerMillion: config.inputUsdPerMillion,
    outputUsdPerMillion: config.outputUsdPerMillion,
  });
}

function usageFromThrown(error: unknown): { inputTokens: number; outputTokens: number } | null {
  if (NoObjectGeneratedError.isInstance(error)) {
    return reportedTokenUsage({ usage: error.usage });
  }
  return reportedTokenUsage(error);
}

function promptFor(view: CommentaryViewEntry[]): string {
  return [
    "Write the Tuesday note for this league week.",
    "Use only the results in the JSON. Each result is one league person for this week: person id, display name, year, week, outcome, points, and team abbreviation.",
    "Return at most 3 lines. A line is one sentence plus every result that sentence cites.",
    "Cite a result by its league person, year, week, outcome, points, and team abbreviation when you include one.",
    "Do not invent a person, score, team, or season.",
    "Do not mention league history or all-time records.",
    "Do not compare this week with another season unless you name that season's four-digit year, and only name a year that appears on a result you cite.",
    "If nothing in the results is worth a sentence, return an empty list.",
    JSON.stringify(view),
  ].join("\n");
}

function linesJson(lines: CommentaryLine[]): Prisma.InputJsonValue {
  return lines.map((line) => ({
    sentence: line.sentence,
    cells: line.cells.map((cell) => ({
      leaguePersonId: cell.leaguePersonId,
      year: cell.year,
      week: cell.week,
      outcome: cell.outcome,
      points: cell.points,
      ...(cell.teamAbbreviation != null && cell.teamAbbreviation !== ""
        ? { teamAbbreviation: cell.teamAbbreviation }
        : {}),
    })),
  }));
}

async function findRun(key: RunKey): Promise<StoredRun | null> {
  return prisma.commentaryRun.findUnique({
    where: { leagueId_nflSeasonYear_weekNumber: key },
    select: { id: true, status: true, outcomeText: true },
  });
}

/**
 * One commentary run for the league-week.
 * An existing row is left as it is and the model is not called.
 * The caller sends the scores email either way.
 */
export async function runWeeklyCommentary(key: RunKey): Promise<WeeklyCommentaryResult> {
  const existing = await findRun(key);
  if (existing) {
    return { outcomeText: settledText(existing) };
  }

  await linkLeaguePersons(key.leagueId);

  let created: StoredRun;
  try {
    created = await prisma.commentaryRun.create({
      data: {
        leagueId: key.leagueId,
        nflSeasonYear: key.nflSeasonYear,
        weekNumber: key.weekNumber,
        status: "PENDING",
        spend: new Prisma.Decimal(0),
      },
      select: { id: true, status: true, outcomeText: true },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    return { outcomeText: settledText(await findRun(key)) };
  }

  const config = readCommentaryConfig();
  if (!config) {
    await prisma.commentaryRun.update({
      where: { id: created.id },
      data: {
        status: "ABNORMAL",
        stopReason: COMMENTARY_STOP_MISSING_PRICE,
        outcomeText: null,
        spend: new Prisma.Decimal(0),
      },
    });
    return { outcomeText: null };
  }

  const view = await buildCommentaryView(key);
  const gateway = createGateway({ apiKey: config.apiKey });

  // One SDK call. A short list or unused room under $1 does not start another.
  let usage: { inputTokens: number; outputTokens: number } | null = null;
  let output: unknown;
  try {
    const result = await generateText({
      model: gateway(config.modelId),
      maxRetries: 0,
      output: Output.array({ element: commentaryLineSchema }),
      prompt: promptFor(view),
    });
    usage = reportedTokenUsage(result);
    try {
      output = result.output;
    } catch (error) {
      usage = usageFromThrown(error) ?? usage;
      throw error;
    }
  } catch (error) {
    await prisma.commentaryRun.update({
      where: { id: created.id },
      data: {
        status: "ABNORMAL",
        stopReason: COMMENTARY_STOP_MODEL_ERROR,
        outcomeText: null,
        spend: spendFor(usage ?? usageFromThrown(error), config),
      },
    });
    return { outcomeText: null };
  }

  const parsed = parseCommentaryLines(output);
  if (!parsed) {
    await prisma.commentaryRun.update({
      where: { id: created.id },
      data: {
        status: "ABNORMAL",
        stopReason: COMMENTARY_STOP_MODEL_ERROR,
        outcomeText: null,
        spend: spendFor(usage, config),
      },
    });
    return { outcomeText: null };
  }

  const fresh = await loadFreshPickCells(key);
  const kept = keepCheckedLines(parsed, fresh);
  const outcomeText = outcomeTextForKeptLines(kept);
  await prisma.commentaryRun.update({
    where: { id: created.id },
    data: {
      status: "SETTLED",
      stopReason: null,
      outcomeText,
      lines: kept.length === 0 ? [] : linesJson(kept),
      spend: spendFor(usage, config),
    },
  });
  return { outcomeText };
}
