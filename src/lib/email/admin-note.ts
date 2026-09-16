import { z } from "zod";

import { getAppBaseUrl } from "@/lib/email/app-base-url";
import { formatEmailSubject } from "@/lib/email/test-league-labeling";

export const ADMIN_NOTE_MAX_LENGTH = 2000;

export const adminNoteBodySchema = z.object({
  note: z.string().trim().min(1).max(ADMIN_NOTE_MAX_LENGTH),
});

export function adminNoteSubject(leagueName: string, isTestLeague: boolean): string {
  return formatEmailSubject(`[${leagueName}] A note from your commissioner`, isTestLeague);
}

export function adminNoteLeagueUrl(leagueId: string): string {
  return `${getAppBaseUrl()}/leagues/${leagueId}`;
}

export async function parseAdminNoteBody(
  request: Request,
): Promise<{ ok: true; note: string } | { ok: false; message: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  let raw: unknown;

  try {
    if (contentType.includes("application/json")) {
      raw = await request.json();
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      raw = { note: form.get("note") };
    } else {
      raw = await request.json();
    }
  } catch {
    return { ok: false, message: "Invalid body" };
  }

  const parsed = adminNoteBodySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Note is required (1–2000 characters)" };
  }
  return { ok: true, note: parsed.data.note };
}
