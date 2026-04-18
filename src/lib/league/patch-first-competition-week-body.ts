import { z } from "zod";

/** PATCH `/api/leagues/[leagueId]/first-competition-week` JSON body (Story 2.7). */
export const patchFirstCompetitionWeekBodySchema = z
  .object({
    firstCompetitionWeek: z.coerce
      .number()
      .int("Week must be a whole number")
      .min(1, "Week must be at least 1")
      .max(18, "Week must be at most 18"),
  })
  .strict();

export type PatchFirstCompetitionWeekBody = z.infer<typeof patchFirstCompetitionWeekBodySchema>;
