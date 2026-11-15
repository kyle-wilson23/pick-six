import type { CommentaryLine } from "./line-schema";
import { QUIET_WEEK_SENTENCE } from "./quiet-week";
import type { CommentaryWeekViewRow } from "./week-view";

const MAX_CONFIRMED = 3;

const BANNED_PHRASE = /league history|all-time/i;

const YEAR_COMPARISON =
  /\b(last|next|previous|prior) year\b|\byears? ago\b|\ba year (earlier|later|before|after)\b/i;

function namesFourDigitYear(sentence: string): boolean {
  return /\b\d{4}\b/.test(sentence);
}

function sentenceDropped(sentence: string): boolean {
  if (sentence.trim() === "") return true;
  if (sentence === QUIET_WEEK_SENTENCE) return true;
  if (BANNED_PHRASE.test(sentence)) return true;
  if (!namesFourDigitYear(sentence) && YEAR_COMPARISON.test(sentence)) return true;
  return false;
}

function cellsMatch(line: CommentaryLine, row: CommentaryWeekViewRow): boolean {
  if (line.outcome !== row.outcome) return false;
  if (line.points !== row.points) return false;
  if (line.team !== row.teamAbbreviation) return false;
  return true;
}

/**
 * Keep a sentence only when its cited cells match this week's row.
 * Does not rewrite the sentence and does not pad the list.
 */
export function confirmCommentaryLines(
  lines: CommentaryLine[],
  rows: CommentaryWeekViewRow[],
  digest: { year: number; week: number },
): string[] {
  const byPerson = new Map(rows.map((row) => [row.personId, row]));
  const confirmed: string[] = [];
  for (const line of lines) {
    if (confirmed.length >= MAX_CONFIRMED) break;
    if (line.year !== digest.year || line.week !== digest.week) continue;
    const row = byPerson.get(line.personId);
    if (row == null || !cellsMatch(line, row)) continue;
    if (sentenceDropped(line.sentence)) continue;
    confirmed.push(line.sentence);
  }
  return confirmed;
}
