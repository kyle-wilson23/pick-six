import { render } from "@react-email/components";
import { createElement } from "react";

import { adminNoteSubject } from "@/lib/email/admin-note";
import { AdminNoteEmail } from "@/lib/email/templates/AdminNoteEmail";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** HTTP header values are ByteStrings — strip control chars / non-Latin-1. */
export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n\0]/g, "").replace(/[^\x20-\x7E]/g, "");
}

export async function renderAdminNotePreviewHtml(args: {
  leagueName: string;
  note: string;
  leagueUrl: string;
  isTestLeague: boolean;
}): Promise<{ html: string; subject: string }> {
  const subject = adminNoteSubject(args.leagueName, args.isTestLeague);
  const html = await render(
    createElement(AdminNoteEmail, {
      leagueName: args.leagueName,
      note: args.note,
      leagueUrl: args.leagueUrl,
      isTestLeague: args.isTestLeague,
    }),
  );

  const subjectBanner = `<p style="font-family:sans-serif;margin:16px;padding:12px;background:#f5f5f5;border-radius:4px"><strong>Subject:</strong> ${escapeHtml(subject)}</p>`;
  const previewHtml = /<body[^>]*>/i.test(html)
    ? html.replace(/<body([^>]*)>/i, (_match, attrs: string) => `<body${attrs}>${subjectBanner}`)
    : `${subjectBanner}${html}`;

  return { html: previewHtml, subject };
}
