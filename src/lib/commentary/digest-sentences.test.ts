import { CommentaryRunStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { digestCommentarySentences } from "./digest-sentences";
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
