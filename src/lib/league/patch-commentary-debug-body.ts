import { z } from "zod";

/** PATCH `/api/leagues/[leagueId]/commentary-debug` JSON body (Story 10.4). */
export const patchCommentaryDebugBodySchema = z
  .object({
    commentaryDebug: z.boolean(),
  })
  .strict();

export type PatchCommentaryDebugBody = z.infer<typeof patchCommentaryDebugBodySchema>;
