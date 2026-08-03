import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/normalize-email";

export type RegisterUserResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; code: "EMAIL_IN_USE" };

/**
 * Duck-type P2002 — `instanceof` breaks when Prisma is bundled (e.g. Turbopack).
 * `User.create` has a single business unique (`email`); treat any P2002 as email-in-use
 * even when `meta.target` is a constraint name (e.g. `User_email_key`).
 */
export function isUniqueEmailViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  return (error as { code?: string }).code === "P2002";
}

/** Creates a User with hashed password only — no league membership (self-serve registration). */
export async function registerUser(input: {
  email: string;
  password: string;
}): Promise<RegisterUserResult> {
  const email = normalizeEmail(input.email);
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });
    return { ok: true, userId: user.id, email };
  } catch (e) {
    if (isUniqueEmailViolation(e)) {
      return { ok: false, code: "EMAIL_IN_USE" };
    }
    throw e;
  }
}
