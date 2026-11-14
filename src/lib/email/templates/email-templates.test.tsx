import { createElement } from "react";
import { render } from "@react-email/components";
import { describe, expect, it } from "vitest";

import { TEST_LEAGUE_EMAIL_BODY_NOTICE } from "@/lib/email/test-league-labeling";

import { AdminNoteEmail } from "./AdminNoteEmail";
import { InvitationEmail } from "./InvitationEmail";
import { PasswordResetEmail } from "./PasswordResetEmail";
import { ReminderEmail } from "./ReminderEmail";
import { TuesdayDigestEmail } from "./TuesdayDigestEmail";

describe("email templates CTA + plaintext fallback", () => {
  it("TuesdayDigestEmail includes Make your picks CTA, href, and plaintext fallback", async () => {
    const picksUrl = "https://example.test/leagues/abc/picks";
    const html = await render(
      createElement(TuesdayDigestEmail, {
        leagueName: "Office League",
        weekNumber: 3,
        standings: [
          {
            rank: 1,
            displayName: "Alex",
            imageUrl: null,
            totalPoints: 12,
            wins: 2,
            losses: 0,
          },
        ],
        jailedTeamName: "Eagles",
        jailedTeamAbbreviation: "PHI",
        picksUrl,
        adminNote: "Have fun this week!",
        isTestLeague: false,
      }),
    );

    expect(html).toContain("Make your picks");
    expect(html).toContain(picksUrl);
    expect(html).toContain("Or paste this link:");
    expect(html).toContain("#2ECC71");
    expect(html).not.toContain("Weekly note");
    // CTA should appear before commissioner note in HTML source order
    expect(html.indexOf("Make your picks")).toBeLessThan(
      html.indexOf("Note from your commissioner"),
    );
  });

  it("TuesdayDigestEmail standings show photo thumb or initials by imageUrl", async () => {
    const photoUrl = "https://blob.example.test/avatars/alex.webp";
    const html = await render(
      createElement(TuesdayDigestEmail, {
        leagueName: "Office League",
        weekNumber: 3,
        standings: [
          {
            rank: 1,
            displayName: "Alex Rivera",
            imageUrl: photoUrl,
            totalPoints: 12,
            wins: 2,
            losses: 0,
          },
          {
            rank: 2,
            displayName: "Sam Lee",
            imageUrl: null,
            totalPoints: 10,
            wins: 1,
            losses: 1,
          },
          {
            rank: 3,
            displayName: "Pat",
            imageUrl: "   ",
            totalPoints: 8,
            wins: 0,
            losses: 2,
          },
          {
            rank: 4,
            displayName: "Jamie Cox",
            imageUrl: "not-a-url",
            totalPoints: 6,
            wins: 0,
            losses: 3,
          },
        ],
        jailedTeamName: null,
        jailedTeamAbbreviation: null,
        picksUrl: "https://example.test/leagues/abc/picks",
        adminNote: null,
        isTestLeague: false,
      }),
    );

    expect(html).toContain(`src="${photoUrl}"`);
    expect(html).toContain(`alt="AR"`);
    expect(html).toContain("width=\"28\"");
    expect(html).toContain("height=\"28\"");
    expect(html).toContain("Alex Rivera");
    expect(html).toContain("Sam Lee");
    expect(html).toContain("SL");
    expect(html).toContain("PA");
    expect(html).toContain("JC");
    expect(html).not.toContain("not-a-url");
    // Null/blank/non-http imageUrl must not emit an empty img src
    expect(html).not.toMatch(/src=["']\s*["']/);
  });

  it("TuesdayDigestEmail shows the stored weekly note and not cells or a stop reason", async () => {
    const quiet = "Quiet week. Nothing new for the record book.";
    const quietHtml = await render(
      createElement(TuesdayDigestEmail, {
        leagueName: "Office League",
        weekNumber: 3,
        standings: [],
        jailedTeamName: "Eagles",
        jailedTeamAbbreviation: "PHI",
        picksUrl: "https://example.test/leagues/abc/picks",
        adminNote: "Have fun this week!",
        weeklyNote: quiet,
        isTestLeague: false,
      }),
    );
    expect(quietHtml).toContain("Weekly note");
    expect(quietHtml).toContain(quiet);
    expect(quietHtml.indexOf("Weekly note")).toBeLessThan(quietHtml.indexOf("Make your picks"));
    expect(quietHtml.indexOf("Make your picks")).toBeLessThan(
      quietHtml.indexOf("Note from your commissioner"),
    );
    expect(quietHtml).not.toContain("missing_price");
    expect(quietHtml).not.toContain("model_error");
    expect(quietHtml).not.toContain("leaguePersonId");

    const kept = "Alex won the week.\nSam tied the Eagles.";
    const keptHtml = await render(
      createElement(TuesdayDigestEmail, {
        leagueName: "Office League",
        weekNumber: 3,
        standings: [],
        jailedTeamName: null,
        jailedTeamAbbreviation: null,
        picksUrl: "https://example.test/leagues/abc/picks",
        adminNote: null,
        weeklyNote: kept,
        isTestLeague: false,
      }),
    );
    expect(keptHtml).toContain("Weekly note");
    expect(keptHtml).toContain("Alex won the week.");
    expect(keptHtml).toContain("Sam tied the Eagles.");
    expect(keptHtml).not.toContain("WIN");
    expect(keptHtml).not.toContain("missing_price");
    expect(keptHtml).not.toContain("model_error");
  });

  it("ReminderEmail slot 1 / slot 2 keep labels + plaintext fallback and name the lock time", async () => {
    const picksUrl = "https://example.test/leagues/abc/picks";
    const pickDeadlineUtc = new Date("2026-09-10T00:10:00.000Z");

    const slot1 = await render(
      createElement(ReminderEmail, {
        leagueName: "Office League",
        weekNumber: 3,
        recipientDisplayName: "Alex",
        jailedTeamName: "Eagles",
        jailedTeamAbbreviation: "PHI",
        picksUrl,
        slot: 1,
        pickDeadlineUtc,
      }),
    );
    expect(slot1).toContain("Make your picks");
    expect(slot1).toContain(picksUrl);
    expect(slot1).toContain("Or paste this link:");
    expect(slot1).toContain("Picks lock Wednesday, September 9 at 8:10 PM ET.");
    expect(slot1.toLowerCase()).not.toContain("thursday's deadline");
    expect(slot1.toLowerCase()).not.toContain("in about one hour");

    const slot2 = await render(
      createElement(ReminderEmail, {
        leagueName: "Office League",
        weekNumber: 3,
        recipientDisplayName: "Alex",
        jailedTeamName: null,
        jailedTeamAbbreviation: null,
        picksUrl,
        slot: 2,
        pickDeadlineUtc,
      }),
    );
    expect(slot2).toContain("Submit your pick now");
    expect(slot2).toContain(picksUrl);
    expect(slot2).toContain("Or paste this link:");
    expect(slot2).toContain("picks lock Wednesday, September 9 at 8:10 PM ET");
    expect(slot2.toLowerCase()).not.toContain("thursday");
  });

  it("AdminNoteEmail includes commissioner note, Open league CTA, and plaintext fallback", async () => {
    const leagueUrl = "https://example.test/leagues/abc";
    const html = await render(
      createElement(AdminNoteEmail, {
        leagueName: "Office League",
        note: "Bring snacks Thursday night.",
        leagueUrl,
        isTestLeague: false,
      }),
    );

    expect(html).toContain("Note from your commissioner");
    expect(html).toContain("Bring snacks Thursday night.");
    expect(html).toContain("Open league");
    expect(html).toContain(leagueUrl);
    expect(html).toContain("Or paste this link:");
    expect(html).not.toContain(TEST_LEAGUE_EMAIL_BODY_NOTICE);
  });

  it("AdminNoteEmail includes test-league notice when flagged", async () => {
    const html = await render(
      createElement(AdminNoteEmail, {
        leagueName: "Rehearsal League",
        note: "Practice only",
        leagueUrl: "https://example.test/leagues/abc",
        isTestLeague: true,
      }),
    );

    expect(html).toContain(TEST_LEAGUE_EMAIL_BODY_NOTICE);
    expect(html).toContain("Practice only");
  });

  it("InvitationEmail includes Accept invitation + signup URL fallback", async () => {
    const signupUrl = "https://example.test/signup?invite=tok";
    const html = await render(
      createElement(InvitationEmail, {
        leagueName: "Office League",
        signupUrl,
      }),
    );
    expect(html).toContain("Accept invitation");
    expect(html).toContain(signupUrl);
    expect(html).toContain("Or paste this link:");
  });

  it("PasswordResetEmail includes Reset password + plaintext reset URL", async () => {
    const resetUrl = "https://example.test/reset-password?token=abc";
    const html = await render(createElement(PasswordResetEmail, { resetUrl }));
    expect(html).toContain("Reset password");
    expect(html).toContain(resetUrl);
    expect(html).toContain("Or paste this link:");
    expect(html).toContain("expires in one hour");
    expect(html).toContain("If you did not request a password reset");
  });
});
