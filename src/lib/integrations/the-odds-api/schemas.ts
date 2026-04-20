import { z } from "zod";

/** One bookmaker market outcome (h2h or spreads) from The Odds API v4. */
export const theOddsApiOutcomeSchema = z.object({
  name: z.string(),
  price: z.number(),
  point: z.number().optional(),
});

export const theOddsApiMarketSchema = z.object({
  key: z.string(),
  outcomes: z.array(theOddsApiOutcomeSchema),
});

export const theOddsApiBookmakerSchema = z.object({
  key: z.string(),
  title: z.string().optional(),
  markets: z.array(theOddsApiMarketSchema),
});

export const theOddsApiEventSchema = z.object({
  id: z.string(),
  sport_key: z.string(),
  commence_time: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  bookmakers: z.array(theOddsApiBookmakerSchema),
});

export const theOddsApiOddsResponseSchema = z.array(theOddsApiEventSchema);

export type TheOddsApiEvent = z.infer<typeof theOddsApiEventSchema>;
