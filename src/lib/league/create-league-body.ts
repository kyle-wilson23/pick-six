import { z } from "zod";

export const LEAGUE_NAME_MAX_LENGTH = 100;

/** POST `/api/leagues` JSON body (shared with Route Handler + tests). */
export const createLeagueBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(LEAGUE_NAME_MAX_LENGTH, "Name is too long"),
  firstCompetitionWeek: z.coerce
    .number()
    .int("Week must be a whole number")
    .min(1, "Week must be at least 1")
    .max(18, "Week must be at most 18")
    .optional()
    .default(1),
});

export type CreateLeagueBody = z.infer<typeof createLeagueBodySchema>;
