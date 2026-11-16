import type { CommentaryRunStatus } from "@prisma/client";

type CommentaryRunSentences = { status: CommentaryRunStatus; sentences: string[] };

/** Proved sentences and the quiet line are stored on a completed run. A stop stays hidden. */
export function digestCommentarySentences(run: CommentaryRunSentences | null): string[] {
  if (run == null || run.status !== "COMPLETED") return [];
  return run.sentences;
}

/** Weekly Email shows a completed run only while the hold is on. Debug off and a stop stay blank. */
export function heldCommentarySentences(args: {
  commentaryDebug: boolean;
  run: CommentaryRunSentences | null;
}): string[] {
  if (!args.commentaryDebug) return [];
  return digestCommentarySentences(args.run);
}
