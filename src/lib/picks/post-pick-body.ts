import { z } from "zod";

import { zNflRegularSeasonWeek } from "@/lib/nfl/nfl-regular-season";

/** POST `/api/leagues/[leagueId]/picks` — camelCase JSON per project context. */
export const postPickBodySchema = z.object({
  teamId: z.string().min(1, "teamId is required"),
  nflWeekNumber: zNflRegularSeasonWeek,
  antiJailedBonus: z.boolean().optional().default(false),
});

export type PostPickBody = z.infer<typeof postPickBodySchema>;
