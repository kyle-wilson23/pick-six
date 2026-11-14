import { z } from "zod";

/** Written by the app when a normal finish keeps zero lines. The model does not write this. */
export const QUIET_WEEK_SENTENCE = "Quiet week. Nothing new for the record book.";

const BANNED_PHRASES = ["league history", "all-time"] as const;

/** Season comparisons that are dropped when the sentence names no 4-digit year. */
const UNNAMED_SEASON_COMPARISONS = [
  "last year",
  "previous year",
  "prior year",
  "year before",
  "previous season",
] as const;

export const commentaryCellSchema = z.object({
  leaguePersonId: z.string().min(1),
  year: z.number().int(),
  week: z.number().int(),
  outcome: z.enum(["WIN", "LOSS", "TIE"]),
  points: z.number().finite(),
  teamAbbreviation: z.string().nullish(),
});

export const commentaryLineSchema = z.object({
  sentence: z.string().min(1),
  cells: z.array(commentaryCellSchema),
});

/** At most three lines. A longer model list is sliced before this parse. */
export const commentaryLineListSchema = z.array(commentaryLineSchema).max(3);

export type CommentaryCell = z.infer<typeof commentaryCellSchema>;
export type CommentaryLine = z.infer<typeof commentaryLineSchema>;

/** A cell the checker read from `Pick` for this season and week. */
export type FreshPickCell = {
  leaguePersonId: string;
  year: number;
  week: number;
  outcome: "WIN" | "LOSS" | "TIE";
  points: number;
  teamAbbreviation: string;
};

export type CommentaryRunSection = {
  status: "PENDING" | "SETTLED" | "ABNORMAL";
  outcomeText: string | null;
};

/**
 * Accept a model payload as a Zod list of at most three lines.
 * Returns null when the payload is not that list. Extra lines beyond three are ignored.
 */
export function parseCommentaryLines(output: unknown): CommentaryLine[] | null {
  if (!Array.isArray(output)) {
    return null;
  }
  const parsed = commentaryLineListSchema.safeParse(output.slice(0, 3));
  return parsed.success ? parsed.data : null;
}

function citedTeam(cell: CommentaryCell): string | null {
  if (cell.teamAbbreviation == null || cell.teamAbbreviation === "") {
    return null;
  }
  return cell.teamAbbreviation;
}

function cellMatchesRow(cell: CommentaryCell, row: FreshPickCell): boolean {
  if (row.leaguePersonId !== cell.leaguePersonId) return false;
  if (row.year !== cell.year) return false;
  if (row.week !== cell.week) return false;
  if (row.outcome !== cell.outcome) return false;
  if (row.points !== cell.points) return false;
  const team = citedTeam(cell);
  if (team != null && team !== row.teamAbbreviation) return false;
  return true;
}

export function citedCellMatchesFresh(cell: CommentaryCell, fresh: FreshPickCell[]): boolean {
  return fresh.some((row) => cellMatchesRow(cell, row));
}

function fourDigitYears(sentence: string): string[] {
  return sentence.match(/\b\d{4}\b/g) ?? [];
}

function sentenceIsDropped(sentence: string, matchedYears: number[]): boolean {
  const lower = sentence.toLowerCase();
  if (BANNED_PHRASES.some((phrase) => lower.includes(phrase))) {
    return true;
  }
  const years = fourDigitYears(sentence);
  if (years.length === 0 && UNNAMED_SEASON_COMPARISONS.some((phrase) => lower.includes(phrase))) {
    return true;
  }
  const readYears = new Set(matchedYears.map(String));
  return years.some((year) => !readYears.has(year));
}

/**
 * Keep model sentences whose every cited cell matches a fresh read, in order, at most three.
 * The sentence text is the model's. Dropped lines are absent. Nothing is rewritten or padded.
 */
export function keepCheckedLines(lines: CommentaryLine[], fresh: FreshPickCell[]): CommentaryLine[] {
  const kept: CommentaryLine[] = [];
  for (const line of lines.slice(0, 3)) {
    if (line.cells.length === 0) {
      continue;
    }
    const matchedYears: number[] = [];
    let mismatch = false;
    for (const cell of line.cells) {
      const row = fresh.find((candidate) => cellMatchesRow(cell, candidate));
      if (!row) {
        mismatch = true;
        break;
      }
      matchedYears.push(row.year);
    }
    if (mismatch || sentenceIsDropped(line.sentence, matchedYears)) {
      continue;
    }
    kept.push(line);
  }
  return kept;
}

/** Settled display text: the kept sentences, or the quiet sentence when none were kept. */
export function outcomeTextForKeptLines(lines: CommentaryLine[]): string {
  if (lines.length === 0) {
    return QUIET_WEEK_SENTENCE;
  }
  return lines.map((line) => line.sentence).join("\n");
}

/** Digest section text. Only a settled row with stored text renders. */
export function commentarySectionText(row: CommentaryRunSection | null): string | null {
  if (row?.status !== "SETTLED") {
    return null;
  }
  if (row.outcomeText == null || row.outcomeText.trim() === "") {
    return null;
  }
  return row.outcomeText;
}
