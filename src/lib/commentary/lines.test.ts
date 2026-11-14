import { describe, expect, it } from "vitest";

import {
  QUIET_WEEK_SENTENCE,
  commentarySectionText,
  keepCheckedLines,
  outcomeTextForKeptLines,
  parseCommentaryLines,
  type CommentaryLine,
  type FreshPickCell,
} from "./lines";

const fresh: FreshPickCell = {
  leaguePersonId: "person-1",
  year: 2026,
  week: 4,
  outcome: "WIN",
  points: 2,
  teamAbbreviation: "PHI",
};

function line(sentence: string, cell: Partial<CommentaryLine["cells"][number]> = {}): CommentaryLine {
  return {
    sentence,
    cells: [
      {
        leaguePersonId: fresh.leaguePersonId,
        year: fresh.year,
        week: fresh.week,
        outcome: fresh.outcome,
        points: fresh.points,
        teamAbbreviation: fresh.teamAbbreviation,
        ...cell,
      },
    ],
  };
}

describe("parseCommentaryLines", () => {
  it("keeps the first three lines when the model returns more", () => {
    const parsed = parseCommentaryLines([
      line("One."),
      line("Two."),
      line("Three."),
      { sentence: 4 },
    ]);
    expect(parsed?.map((entry) => entry.sentence)).toEqual(["One.", "Two.", "Three."]);
  });

  it("returns null when the payload is not a list of lines", () => {
    expect(parseCommentaryLines(null)).toBeNull();
    expect(parseCommentaryLines({ lines: [] })).toBeNull();
    expect(parseCommentaryLines([{ sentence: "", cells: [] }])).toBeNull();
  });
});

describe("keepCheckedLines", () => {
  it("drops a mismatched cell and keeps the other sentence verbatim", () => {
    const keptSentence = "  Alex won the week.  ";
    const kept = keepCheckedLines(
      [line("Alex lost.", { outcome: "LOSS" }), line(keptSentence)],
      [fresh],
    );
    expect(kept.map((entry) => entry.sentence)).toEqual([keptSentence]);
    expect(kept).toHaveLength(1);
  });

  it("drops league history and all-time in any case", () => {
    const kept = keepCheckedLines(
      [line("This is League History."), line("The ALL-TIME best."), line("Alex won the week.")],
      [fresh],
    );
    expect(kept.map((entry) => entry.sentence)).toEqual(["Alex won the week."]);
  });

  it("drops an unnamed season comparison and a year the checker did not read", () => {
    const dropped = keepCheckedLines(
      [
        line("Better than last year."),
        line("Better than the Previous Year."),
        line("The prior year was different."),
      ],
      [fresh],
    );
    expect(dropped).toEqual([]);
    expect(
      keepCheckedLines(
        [
          line("The year before was quieter."),
          line("Better than the previous season."),
          line("In 1999 Alex won."),
        ],
        [fresh],
      ),
    ).toEqual([]);

    const named = "Better than last year, 2026.";
    const kept = keepCheckedLines([line(named)], [fresh]);
    expect(kept.map((entry) => entry.sentence)).toEqual([named]);
  });

  it("drops a cited team that does not match and keeps a cell that omits the team", () => {
    const omitted = "Alex won the week.";
    const kept = keepCheckedLines(
      [line("Wrong team.", { teamAbbreviation: "DAL" }), line(omitted, { teamAbbreviation: null })],
      [fresh],
    );
    expect(kept.map((entry) => entry.sentence)).toEqual([omitted]);
  });

  it("does not keep a fourth line or a sentence with no cited cell", () => {
    const fourth = "Fourth stays out.";
    const kept = keepCheckedLines(
      [line("One."), line("Two."), line("Three."), line(fourth), { sentence: "No cells.", cells: [] }],
      [fresh],
    );
    expect(kept.map((entry) => entry.sentence)).toEqual(["One.", "Two.", "Three."]);
    expect(kept.map((entry) => entry.sentence)).not.toContain(fourth);
  });
});

describe("outcome text", () => {
  it("stores the quiet sentence only when nothing was kept", () => {
    expect(outcomeTextForKeptLines([])).toBe(QUIET_WEEK_SENTENCE);
    expect(outcomeTextForKeptLines([line("Alex won the week.")])).toBe("Alex won the week.");
  });

  it("shows settled text and hides pending or abnormal rows", () => {
    expect(commentarySectionText({ status: "SETTLED", outcomeText: QUIET_WEEK_SENTENCE })).toBe(
      QUIET_WEEK_SENTENCE,
    );
    expect(commentarySectionText({ status: "PENDING", outcomeText: QUIET_WEEK_SENTENCE })).toBeNull();
    expect(commentarySectionText({ status: "ABNORMAL", outcomeText: null })).toBeNull();
    expect(commentarySectionText(null)).toBeNull();
  });
});
