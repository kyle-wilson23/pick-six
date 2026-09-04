import { normalizeEmail } from "@/lib/normalize-email";

export type SuperuserEnv = Record<string, string | undefined>;

/** Normalized `SUPERUSER_EMAIL`, or `null` when unset/blank (nobody is superuser). */
export function configuredSuperuserEmail(
  env: SuperuserEnv = process.env as SuperuserEnv,
): string | null {
  const raw = env.SUPERUSER_EMAIL?.trim();
  if (!raw) {
    return null;
  }
  return normalizeEmail(raw);
}

/** True when `email` matches the singleton `SUPERUSER_EMAIL` env value. */
export function isSuperuserEmail(
  email: string | null | undefined,
  env: SuperuserEnv = process.env as SuperuserEnv,
): boolean {
  const configured = configuredSuperuserEmail(env);
  if (!configured || email == null || email.trim() === "") {
    return false;
  }
  return normalizeEmail(email) === configured;
}
