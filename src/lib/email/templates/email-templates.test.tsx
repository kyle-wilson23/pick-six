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
          { rank: 1, displayName: "Alex", totalPoints: 12, wins: 2, losses: 0 },
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
