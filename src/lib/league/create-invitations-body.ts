import { z } from "zod";

import { normalizeEmail } from "@/lib/normalize-email";

/** Documented cap for admin batch invites (Story 2.2 AC5). */
export const MAX_INVITE_EMAILS_PER_REQUEST = 50;

/**
 * Dedupe after `normalizeEmail` (trim + lowercase). Preserves first-seen order.
 */
export function normalizeInviteEmailList(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    const n = normalizeEmail(s);
    if (!n || seen.has(n)) {
      continue;
    }
    seen.add(n);
    out.push(n);
  }
  return out;
}

const emailField = z.string().email("Invalid email address");

/** POST `/api/leagues/[leagueId]/invitations` JSON body. */
export const createInvitationsBodySchema = z
  .object({
    emails: z
      .array(z.string().min(1).max(320))
      .min(1, "At least one email is required")
      .max(
        MAX_INVITE_EMAILS_PER_REQUEST,
        `At most ${MAX_INVITE_EMAILS_PER_REQUEST} emails per request`,
      ),
  })
  .transform(({ emails }) => ({
    emails: normalizeInviteEmailList(emails),
  }))
  .superRefine((data, ctx) => {
    if (data.emails.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "At least one email is required",
        path: ["emails"],
      });
      return;
    }
    for (let i = 0; i < data.emails.length; i++) {
      const r = emailField.safeParse(data.emails[i]);
      if (!r.success) {
        ctx.addIssue({
          code: "custom",
          message: "Invalid email address",
          path: ["emails", i],
        });
      }
    }
  });

export type CreateInvitationsBody = z.infer<typeof createInvitationsBodySchema>;
