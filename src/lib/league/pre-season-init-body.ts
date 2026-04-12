import { z } from "zod";

/** POST body for pre-season init: empty object only (Story 2.3). */
export const preSeasonInitBodySchema = z.object({}).strict();
