import { CommentaryRunStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { digestCommentarySentences, heldCommentarySentences } from "./digest-sentences";
import { QUIET_WEEK_SENTENCE } from "./quiet-week";

describe("digestCommentarySentences", () => {
  it("shows proved lines and the quiet line only when the run completed", () => {
    expect(
      digestCommentarySentences({
        status: CommentaryRunStatus.COMPLETED,
        sentences: ["Alice took Buffalo for two."],
      }),
    ).toEqual(["Alice took Buffalo for two."]);
    expect(
      digestCommentarySentences({
        status: CommentaryRunStatus.COMPLETED,
        sentences: [QUIET_WEEK_SENTENCE],
      }),
    ).toEqual([QUIET_WEEK_SENTENCE]);
  });

  it("hides a stop, including proved sentences already stored", () => {
    expect(
      digestCommentarySentences({
        status: CommentaryRunStatus.STOPPED,
        sentences: ["Alice took Buffalo for two."],
      }),
    ).toEqual([]);
    expect(
      digestCommentarySentences({
        status: CommentaryRunStatus.STARTED,
        sentences: ["Alice took Buffalo for two."],
      }),
    ).toEqual([]);
    expect(digestCommentarySentences(null)).toEqual([]);
  });
});

describe("heldCommentarySentences", () => {
  const proved = ["Alice took Buffalo for two.", "Bob lost with the Jets."];

  it("yields a completed run's sentences when debug is on", () => {
    expect(
      heldCommentarySentences({
        commentaryDebug: true,
        run: { status: CommentaryRunStatus.COMPLETED, sentences: proved },
      }),
    ).toEqual(proved);
  });

  it("yields none for a stopped run when debug is on, and not the quiet sentence", () => {
    const sentences = heldCommentarySentences({
      commentaryDebug: true,
      run: { status: CommentaryRunStatus.STOPPED, sentences: [...proved, QUIET_WEEK_SENTENCE] },
    });
    expect(sentences).toEqual([]);
    expect(sentences).not.toContain(QUIET_WEEK_SENTENCE);
  });

  it("yields none when debug is off", () => {
    expect(
      heldCommentarySentences({
        commentaryDebug: false,
        run: {
          status: CommentaryRunStatus.COMPLETED,
          sentences: [...proved, QUIET_WEEK_SENTENCE],
        },
      }),
    ).toEqual([]);
  });
});
