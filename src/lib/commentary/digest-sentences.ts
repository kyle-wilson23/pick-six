import type { CommentaryRunStatus } from "@prisma/client";

/** Proved sentences and the quiet line are stored on a completed run. A stop stays hidden. */
export function digestCommentarySentences(
  run: { status: CommentaryRunStatus; sentences: string[] } | null,
): string[] {
  if (run == null || run.status !== "COMPLETED") return [];
  return run.sentences;
}
