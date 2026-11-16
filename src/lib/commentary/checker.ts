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

function citedYears(sentence: string): number[] {
  return [...sentence.matchAll(/\b(\d{4})\b/g)].map((match) => Number(match[1]));
}

function sentenceDropped(sentence: string, yearsOnView: ReadonlySet<number>): boolean {
  if (sentence.trim() === "") return true;
  if (sentence === QUIET_WEEK_SENTENCE) return true;
  if (BANNED_PHRASE.test(sentence)) return true;
  if (!namesFourDigitYear(sentence) && YEAR_COMPARISON.test(sentence)) return true;
  return citedYears(sentence).some((year) => !yearsOnView.has(year));
}

function citedTeam(team: string | null | undefined): string | null {
  return team == null ? null : team;
}

function cellsMatch(line: CommentaryLine, row: CommentaryWeekViewRow): boolean {
  if (line.outcome !== row.outcome) return false;
  if (line.points !== row.points) return false;
  if (citedTeam(line.team) !== row.teamAbbreviation) return false;
  return true;
}

function cellKey(personId: string, year: number, week: number): string {
  return `${personId}\u0000${year}\u0000${week}`;
}

/**
 * Keep a sentence only when person, year, and week hit one row and the cells match.
 * The digest week is not a filter. Does not rewrite the sentence and does not pad the list.
 */
export function confirmCommentaryLines(
  lines: CommentaryLine[],
  rows: CommentaryWeekViewRow[],
  digest: { year: number; week: number },
): string[] {
  void digest;
  const byCell = new Map<string, CommentaryWeekViewRow>();
  for (const row of rows) {
    const key = cellKey(row.personId, row.year, row.week);
    if (!byCell.has(key)) byCell.set(key, row);
  }
  const yearsOnView = new Set(rows.map((row) => row.year));
  const confirmed: string[] = [];
  for (const line of lines) {
    if (confirmed.length >= MAX_CONFIRMED) break;
    const row = byCell.get(cellKey(line.personId, line.year, line.week));
    if (row == null || !cellsMatch(line, row)) continue;
    if (sentenceDropped(line.sentence, yearsOnView)) continue;
    confirmed.push(line.sentence);
  }
  return confirmed;
}
