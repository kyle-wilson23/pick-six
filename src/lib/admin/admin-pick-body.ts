import { z } from "zod";

import { zNflRegularSeasonWeek } from "@/lib/nfl/nfl-regular-season";

/** POST `/api/leagues/[leagueId]/admin/picks` — admin override on behalf of a participant. */
export const adminPickBodySchema = z.object({
  targetMembershipId: z.string().min(1, "targetMembershipId is required"),
  teamId: z.string().min(1, "teamId is required"),
  nflWeekNumber: zNflRegularSeasonWeek,
  antiJailedBonus: z.boolean().optional().default(false),
});

export type AdminPickBody = z.infer<typeof adminPickBodySchema>;
