import { z } from "zod";

/** PATCH `/api/leagues/[leagueId]/commentary` JSON body (Story 10.1). */
export const patchCommentaryEnabledBodySchema = z
  .object({
    commentaryEnabled: z.boolean(),
  })
  .strict();

export type PatchCommentaryEnabledBody = z.infer<typeof patchCommentaryEnabledBodySchema>;
