import { describe, expect, it } from "vitest";

import { renderAdminNotePreviewHtml } from "./render-admin-note-preview";

describe("renderAdminNotePreviewHtml", () => {
  it("injects the subject banner and does not require Resend", async () => {
    const { html, subject } = await renderAdminNotePreviewHtml({
      leagueName: "Office League",
      note: "Bring snacks",
      leagueUrl: "https://example.test/leagues/abc",
      isTestLeague: false,
    });

    expect(subject).toBe("[Office League] A note from your commissioner");
    expect(html).toContain("<strong>Subject:</strong>");
    expect(html).toContain(subject);
    expect(html).toContain("Bring snacks");
    expect(html).toContain("Open league");
  });
});
