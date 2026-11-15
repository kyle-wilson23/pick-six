import { describe, expect, it } from "vitest";

import { confirmCommentaryLines } from "./checker";
import type { CommentaryLine } from "./line-schema";
import { QUIET_WEEK_SENTENCE } from "./quiet-week";
import type { CommentaryWeekViewRow } from "./week-view";

const digest = { year: 2026, week: 4 };

const alice: CommentaryWeekViewRow = {
  personId: "person-alice",
  userDisplayName: "Alice",
  outcome: "WIN",
  points: 2,
  teamAbbreviation: "BUF",
};

function line(overrides: Partial<CommentaryLine> = {}): CommentaryLine {
  return {
    sentence: "Alice took Buffalo for two.",
    personId: alice.personId,
    year: digest.year,
    week: digest.week,
    outcome: "WIN",
    points: 2,
    team: "BUF",
    ...overrides,
  };
}

describe("confirmCommentaryLines", () => {
  it("drops a bad sentence and does not rewrite it", () => {
    const bad = [
      "That belongs in the league history books.",
      "An all-time finish for Alice.",
      "Better than last year.",
    ];
    const confirmed = confirmCommentaryLines(
      bad.map((sentence) => line({ sentence })),
      [alice],
      digest,
    );
    expect(confirmed).toEqual([]);
  });

  it("keeps a sentence that names 2024 and 2026 unchanged", () => {
    const sentence = "Alice's 2024 win showed up again in 2026.";
    expect(confirmCommentaryLines([line({ sentence })], [alice], digest)).toEqual([sentence]);
  });

  it("drops a line that cites another year or week", () => {
    expect(
      confirmCommentaryLines([line({ year: 2025 }), line({ week: 3 })], [alice], digest),
    ).toEqual([]);
  });

  it("keeps at most three confirmed sentences", () => {
    const rows: CommentaryWeekViewRow[] = [
      alice,
      { ...alice, personId: "p2" },
      { ...alice, personId: "p3" },
      { ...alice, personId: "p4" },
    ];
    const confirmed = confirmCommentaryLines(
      rows.map((row, index) =>
        line({
          personId: row.personId,
          sentence: `Line ${index}.`,
        }),
      ),
      rows,
      digest,
    );
    expect(confirmed).toEqual(["Line 0.", "Line 1.", "Line 2."]);
  });

  it("does not pad a single match out to three lines", () => {
    const sentence = "Alice took Buffalo for two.";
    const confirmed = confirmCommentaryLines(
      [line({ sentence }), line({ points: 0 }), line({ personId: "missing" })],
      [alice],
      digest,
    );
    expect(confirmed).toEqual([sentence]);
  });

  it("drops a cell mismatch", () => {
    expect(
      confirmCommentaryLines(
        [
          line({ outcome: "LOSS" }),
          line({ points: 1 }),
          line({ team: "NYJ" }),
          line({ team: undefined }),
        ],
        [alice],
        digest,
      ),
    ).toEqual([]);
  });

  it("drops the quiet-week sentence and keeps a this-year sentence", () => {
    const sentence = "Alice did it this year.";
    expect(
      confirmCommentaryLines(
        [line({ sentence: QUIET_WEEK_SENTENCE }), line({ sentence })],
        [alice],
        digest,
      ),
    ).toEqual([sentence]);
  });

  it("drops league history even when the sentence names a year", () => {
    expect(
      confirmCommentaryLines(
        [line({ sentence: "This is league history from 2024." })],
        [alice],
        digest,
      ),
    ).toEqual([]);
  });
});
