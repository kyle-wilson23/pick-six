import { z } from "zod";

import {
  DEFAULT_SIMULATION_WEEK_COUNT,
  isSimulationWeekCountValid,
} from "@/lib/league/simulation-week";

export const LEAGUE_NAME_MAX_LENGTH = 100;

/** POST `/api/leagues` JSON body (shared with Route Handler + tests). */
export const createLeagueBodySchema = z
  .object({
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
    /** Create-time only; defaults to production (false). */
    isTestLeague: z.boolean().optional().default(false),
    /** Test leagues only; ignored for production. Default 4. */
    simulationWeekCount: z.coerce
      .number()
      .int("Simulation week count must be a whole number")
      .min(1, "Simulation week count must be at least 1")
      .max(18, "Simulation week count must be at most 18")
      .optional()
      .default(DEFAULT_SIMULATION_WEEK_COUNT),
  })
  .superRefine((data, ctx) => {
    if (!data.isTestLeague) {
      return;
    }
    if (!isSimulationWeekCountValid(data.firstCompetitionWeek, data.simulationWeekCount)) {
      ctx.addIssue({
        code: "custom",
        path: ["simulationWeekCount"],
        message:
          "Simulation would run past NFL Week 18; lower first competition week or simulation week count",
      });
    }
  });

export type CreateLeagueBody = z.infer<typeof createLeagueBodySchema>;
