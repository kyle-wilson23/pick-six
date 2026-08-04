import { z } from "zod";

import { firstNameFieldSchema, lastNameFieldSchema } from "@/lib/user-display-name";

/** PATCH `/api/profile` JSON body. */
export const updateProfileBodySchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  firstName: firstNameFieldSchema,
  lastName: lastNameFieldSchema,
});

export const PROFILE_EMAIL_IN_USE_MESSAGE =
  "That email is already in use by another account.";
