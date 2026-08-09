import { createElement } from "react";
import { render } from "@react-email/components";
import { describe, expect, it } from "vitest";

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

  it("ReminderEmail wednesday/thursday keep labels + plaintext fallback", async () => {
    const picksUrl = "https://example.test/leagues/abc/picks";

    const wed = await render(
      createElement(ReminderEmail, {
        leagueName: "Office League",
        weekNumber: 3,
        recipientDisplayName: "Alex",
        jailedTeamName: "Eagles",
        jailedTeamAbbreviation: "PHI",
        picksUrl,
        reminderType: "wednesday",
      }),
    );
    expect(wed).toContain("Make your picks");
    expect(wed).toContain(picksUrl);
    expect(wed).toContain("Or paste this link:");

    const thu = await render(
      createElement(ReminderEmail, {
        leagueName: "Office League",
        weekNumber: 3,
        recipientDisplayName: "Alex",
        jailedTeamName: null,
        jailedTeamAbbreviation: null,
        picksUrl,
        reminderType: "thursday",
      }),
    );
    expect(thu).toContain("Submit your pick now");
    expect(thu).toContain(picksUrl);
    expect(thu).toContain("Or paste this link:");
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
