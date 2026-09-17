import { z } from "zod";

import { getAppBaseUrl } from "@/lib/email/app-base-url";
import { formatEmailSubject } from "@/lib/email/test-league-labeling";

export const ADMIN_NOTE_MAX_LENGTH = 2000;

export const adminNoteBodySchema = z.object({
  note: z.string().trim().min(1).max(ADMIN_NOTE_MAX_LENGTH),
});

export const adminNoteSendBodySchema = adminNoteBodySchema.extend({
  recipientMembershipIds: z.array(z.string().min(1)),
});

export class AdminNoteNoRecipientsError extends Error {
  constructor() {
    super("Select at least one recipient");
    this.name = "AdminNoteNoRecipientsError";
  }
}

export function adminNoteSubject(leagueName: string, isTestLeague: boolean): string {
  return formatEmailSubject(`[${leagueName}] A note from your commissioner`, isTestLeague);
}

export function adminNoteLeagueUrl(leagueId: string): string {
  return `${getAppBaseUrl()}/leagues/${leagueId}`;
}

async function readAdminNoteRaw(
  request: Request,
): Promise<{ ok: true; raw: unknown } | { ok: false; message: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      return { ok: true, raw: await request.json() };
    }
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      return { ok: true, raw: { note: form.get("note") } };
    }
    return { ok: true, raw: await request.json() };
  } catch {
    return { ok: false, message: "Invalid body" };
  }
}

export async function parseAdminNoteBody(
  request: Request,
): Promise<{ ok: true; note: string } | { ok: false; message: string }> {
  const raw = await readAdminNoteRaw(request);
  if (!raw.ok) {
    return raw;
  }

  const parsed = adminNoteBodySchema.safeParse(raw.raw);
  if (!parsed.success) {
    return { ok: false, message: "Note is required (1–2000 characters)" };
  }
  return { ok: true, note: parsed.data.note };
}

export async function parseAdminNoteSendBody(
  request: Request,
): Promise<
  | { ok: true; note: string; recipientMembershipIds: string[] }
  | { ok: false; message: string }
> {
  const raw = await readAdminNoteRaw(request);
  if (!raw.ok) {
    return raw;
  }

  const parsed = adminNoteSendBodySchema.safeParse(raw.raw);
  if (!parsed.success) {
    const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
    if (fields.has("recipientMembershipIds") && !fields.has("note")) {
      return { ok: false, message: "Select at least one recipient" };
    }
    return { ok: false, message: "Note is required (1–2000 characters)" };
  }
  return {
    ok: true,
    note: parsed.data.note,
    recipientMembershipIds: parsed.data.recipientMembershipIds,
  };
}
