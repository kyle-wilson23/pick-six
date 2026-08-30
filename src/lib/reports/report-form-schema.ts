import { z } from "zod";

import { VISIT_TRAIL_MAX } from "./visit-trail";

export const REPORT_DESCRIPTION_MAX = 8000;

export const reportVisitTrailSchema = z
  .array(z.string().max(200))
  .max(VISIT_TRAIL_MAX)
  .default([]);

export const reportDeviceFieldsSchema = z.object({
  userAgent: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().slice(0, 512) : ""),
    z.string(),
  ),
  viewportWidth: z.coerce.number().int().min(0).max(10000),
  viewportHeight: z.coerce.number().int().min(0).max(10000),
});

export const reportDescriptionSchema = z
  .string()
  .trim()
  .min(1, "Please describe the problem.")
  .max(
    REPORT_DESCRIPTION_MAX,
    `Description must be at most ${REPORT_DESCRIPTION_MAX} characters.`,
  );

export const reportPathnameSchema = z.string().trim().max(200).default("/");
