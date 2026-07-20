import { z } from "zod";

/** POST `/api/leagues/[leagueId]/simulation/advance-week` JSON body (Story 8.2). */
export const advanceSimulationWeekBodySchema = z
  .object({
    fromWeek: z.coerce
      .number()
      .int("Week must be a whole number")
      .min(1, "Week must be at least 1")
      .max(18, "Week must be at most 18"),
  })
  .strict();

export type AdvanceSimulationWeekBody = z.infer<typeof advanceSimulationWeekBodySchema>;
