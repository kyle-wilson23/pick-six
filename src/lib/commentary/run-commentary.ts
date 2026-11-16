import "server-only";

import { generateText, Output } from "ai";
import { CommentaryRunStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

import { confirmCommentaryLines } from "./checker";
import { readCommentaryConfig } from "./commentary-config";
import { digestCommentarySentences } from "./digest-sentences";
import { ensureLeaguePersons } from "./ensure-league-persons";
import { commentaryLineListSchema, type CommentaryLine } from "./line-schema";
import { QUIET_WEEK_SENTENCE } from "./quiet-week";
import { addCallSpend, type CallTokenUsage } from "./spend";
import { loadCommentaryWeekView, type CommentaryWeekViewRow } from "./week-view";

const CONFIRMED_LINE_CAP = 3;

export type CommentaryRunResult = {
  sentences: string[];
};

type RunKey = {
  leagueId: string;
  nflSeasonYear: number;
  weekNumber: number;
};

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

function pricedUsage(
  usage: { inputTokens?: number; outputTokens?: number } | undefined,
): CallTokenUsage | null {
  if (usage?.inputTokens == null || usage.outputTokens == null) return null;
  if (!Number.isFinite(usage.inputTokens) || !Number.isFinite(usage.outputTokens)) return null;
  if (usage.inputTokens < 0 || usage.outputTokens < 0) return null;
  return { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens };
}

function stopReasonFor(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") return error.message;
  return "model call failed";
}

function commentaryPrompt(rows: CommentaryWeekViewRow[]): string {
  return [
    "Each line needs the sentence plus personId, year, week, outcome, points, and team. Copy those cells from these rows. Copy teamAbbreviation into team.",
    "Use only these rows.",
    JSON.stringify(rows),
  ].join("\n\n");
}

async function finishStopped(
  id: string,
  stopReason: string,
  spendUsd: Prisma.Decimal,
  sentences: string[],
): Promise<CommentaryRunResult> {
  const run = await prisma.commentaryRun.update({
    where: { id },
    data: {
      status: CommentaryRunStatus.STOPPED,
      stopReason,
      spendUsd,
      sentences,
    },
  });
  return { sentences: digestCommentarySentences(run) };
}

async function handleExisting(run: {
  id: string;
  status: CommentaryRunStatus;
  sentences: string[];
}): Promise<CommentaryRunResult> {
  if (run.status === CommentaryRunStatus.STARTED) {
    const stopped = await prisma.commentaryRun.update({
      where: { id: run.id },
      data: {
        status: CommentaryRunStatus.STOPPED,
        stopReason: "unfinished run",
      },
    });
    return { sentences: digestCommentarySentences(stopped) };
  }
  return { sentences: digestCommentarySentences(run) };
}

export async function runCommentary(args: RunKey): Promise<CommentaryRunResult> {
  await ensureLeaguePersons(args.leagueId);

  const existing = await prisma.commentaryRun.findUnique({
    where: {
      leagueId_nflSeasonYear_weekNumber: {
        leagueId: args.leagueId,
        nflSeasonYear: args.nflSeasonYear,
        weekNumber: args.weekNumber,
      },
    },
  });
  if (existing) return handleExisting(existing);

  const config = readCommentaryConfig();
  if (!config.callable) {
    try {
      await prisma.commentaryRun.create({
        data: {
          leagueId: args.leagueId,
          nflSeasonYear: args.nflSeasonYear,
          weekNumber: args.weekNumber,
          status: CommentaryRunStatus.STOPPED,
          stopReason: config.stopReason,
          spendUsd: new Prisma.Decimal(0),
          sentences: [],
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) return { sentences: [] };
      throw error;
    }
    return { sentences: [] };
  }

  const league = await prisma.league.findUnique({
    where: { id: args.leagueId },
    select: { commentaryWeeklyCeilingUsd: true },
  });
  if (!league) {
    throw new Error("league not found");
  }
  const ceilingUsd = league.commentaryWeeklyCeilingUsd;

  let run: { id: string };
  try {
    run = await prisma.commentaryRun.create({
      data: {
        leagueId: args.leagueId,
        nflSeasonYear: args.nflSeasonYear,
        weekNumber: args.weekNumber,
        status: CommentaryRunStatus.STARTED,
        spendUsd: new Prisma.Decimal(0),
        sentences: [],
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { sentences: [] };
    throw error;
  }

  const digest = { year: args.nflSeasonYear, week: args.weekNumber };
  const confirmed: string[] = [];
  let spend = new Prisma.Decimal(0);

  while (confirmed.length < CONFIRMED_LINE_CAP && spend.lessThan(ceilingUsd)) {
    const promptRows = await loadCommentaryWeekView(args);
    let lines: CommentaryLine[];
    let spentNothing: boolean;
    try {
      const result = await generateText({
        model: config.modelId,
        output: Output.object({ schema: commentaryLineListSchema }),
        prompt: commentaryPrompt(promptRows),
      });
      const usage = pricedUsage(result.totalUsage);
      const nextSpend = addCallSpend(spend, usage, config);
      spentNothing = usage == null || nextSpend.equals(spend);
      spend = nextSpend;
      const output = result.output;
      if (output == null) {
        return finishStopped(run.id, "model returned no output", spend, confirmed);
      }
      lines = output.lines;
    } catch (error) {
      return finishStopped(run.id, stopReasonFor(error), spend, confirmed);
    }

    try {
      const freshRows = await loadCommentaryWeekView(args);
      const kept = confirmCommentaryLines(lines, freshRows, digest);
      for (const sentence of kept) {
        if (confirmed.length >= CONFIRMED_LINE_CAP) break;
        if (confirmed.includes(sentence)) continue;
        confirmed.push(sentence);
      }
      await prisma.commentaryRun.update({
        where: { id: run.id },
        data: { spendUsd: spend, sentences: confirmed },
      });
    } catch (error) {
      return finishStopped(run.id, stopReasonFor(error), spend, confirmed);
    }

    if (spentNothing && confirmed.length < CONFIRMED_LINE_CAP) {
      return finishStopped(run.id, "model call reported no token spend", spend, confirmed);
    }
    if (confirmed.length >= CONFIRMED_LINE_CAP || !spend.lessThan(ceilingUsd)) {
      break;
    }
  }

  const sentences = confirmed.length === 0 ? [QUIET_WEEK_SENTENCE] : confirmed;
  const completed = await prisma.commentaryRun.update({
    where: { id: run.id },
    data: {
      status: CommentaryRunStatus.COMPLETED,
      stopReason: null,
      spendUsd: spend,
      sentences,
    },
  });
  return { sentences: digestCommentarySentences(completed) };
}
