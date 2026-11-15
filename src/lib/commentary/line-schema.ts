import { z } from "zod";

/** One model line: the sentence plus the cells it claims. */
export const commentaryLineSchema = z.object({
  sentence: z.string(),
  personId: z.string(),
  year: z.number().int(),
  week: z.number().int(),
  outcome: z.enum(["WIN", "LOSS", "TIE"]),
  points: z.number(),
  team: z.string().nullish(),
});

/** `Output.object` payload: a Zod list of lines. */
export const commentaryLineListSchema = z.object({
  lines: z.array(commentaryLineSchema),
});

export type CommentaryLine = z.infer<typeof commentaryLineSchema>;
