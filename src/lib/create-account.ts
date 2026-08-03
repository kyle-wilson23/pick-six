import { z } from "zod";

import { signupPasswordFieldSchema } from "@/lib/invitations";

/** POST `/api/auth/register` JSON body (shared with Route Handler + tests). */
export const createAccountBodySchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: signupPasswordFieldSchema,
});

export const EMAIL_IN_USE_MESSAGE =
  "An account with this email already exists. Sign in or reset your password.";
