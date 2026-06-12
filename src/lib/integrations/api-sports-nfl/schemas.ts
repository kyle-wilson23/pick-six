import { z } from "zod";

/** Nested `game.date` from API-Sports American Football `/games`. */
export const apiSportsGameDateSchema = z.object({
  timezone: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  timestamp: z.number().optional(),
});

export const apiSportsGameNestedSchema = z.object({
  id: z.number(),
  stage: z.string().optional(),
  week: z.union([z.string(), z.number()]).optional(),
  date: apiSportsGameDateSchema.optional(),
  status: z
    .object({
      short: z.string().optional(),
      long: z.string().optional(),
    })
    .optional(),
});

export const apiSportsTeamSideSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  code: z.string().optional(),
});

export const apiSportsGameRowSchema = z.object({
  game: apiSportsGameNestedSchema,
  teams: z
    .object({
      home: apiSportsTeamSideSchema,
      away: apiSportsTeamSideSchema,
    })
    .passthrough(),
  scores: z
    .object({
      home: z.object({ total: z.number().nullable().optional() }).optional(),
      away: z.object({ total: z.number().nullable().optional() }).optional(),
    })
    .optional(),
});

export const apiSportsGamesEnvelopeSchema = z.object({
  get: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
  results: z.number().optional(),
  response: z.array(apiSportsGameRowSchema),
});

export type ApiSportsGameRow = z.infer<typeof apiSportsGameRowSchema>;
export type ApiSportsGameDate = z.infer<typeof apiSportsGameDateSchema>;
export type ApiSportsTeamSide = z.infer<typeof apiSportsTeamSideSchema>;
