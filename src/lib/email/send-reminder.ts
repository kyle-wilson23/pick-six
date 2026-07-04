import { createElement } from "react";

import { prisma } from "@/lib/db";
import { getReminderData, type ReminderData } from "@/lib/email/get-reminder-data";
import { resend } from "@/lib/email/resend-client";
import { sendWithRetry } from "@/lib/email/send-with-retry";
import { ReminderEmail } from "@/lib/email/templates/ReminderEmail";

function reminderSubject(
  data: ReminderData,
  reminderType: "wednesday" | "thursday",
): string {
  return reminderType === "wednesday"
    ? `[${data.leagueName}] Week ${data.weekNumber} — Don't Forget Your Pick`
    : `[${data.leagueName}] Week ${data.weekNumber} — Pick Deadline in 1 Hour`;
}

export async function sendReminder({
  leagueId,
  reminderType,
  preloadedData,
}: {
  leagueId: string;
  reminderType: "wednesday" | "thursday";
  preloadedData?: ReminderData;
}): Promise<{ sent: number; failed: number; skipped: number; sentAt: Date | null }> {
  const data = preloadedData ?? (await getReminderData({ leagueId }));

  const skipped = data.submittedCount;
  let sent = 0;
  let failed = 0;

  for (const member of data.outstandingMembers) {
    try {
      await sendWithRetry(async () => {
        const { error } = await resend.emails.send(
          {
            from: "Pick Six <noreply@yourdomain.com>",
            to: [member.email],
            subject: reminderSubject(data, reminderType),
            react: createElement(ReminderEmail, {
              leagueName: data.leagueName,
              weekNumber: data.weekNumber,
              recipientDisplayName: member.displayName,
              jailedTeamName: data.jailedTeamName,
              jailedTeamAbbreviation: data.jailedTeamAbbreviation,
              picksUrl: data.picksUrl,
              reminderType,
            }),
          },
          {
            idempotencyKey: `${reminderType}-reminder:${leagueId}:${data.weekNumber}:${member.membershipId}`,
          },
        );

        if (error) {
          throw error;
        }
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(`[email] ${reminderType} reminder member send failed`, {
        leagueId,
        weekNumber: data.weekNumber,
        membershipId: member.membershipId,
        email: member.email,
        error: err,
      });
    }
  }

  const sentAt = sent > 0 ? new Date() : null;

  if (sentAt != null) {
    const reminderField =
      reminderType === "wednesday" ? "wednesdayReminderSentAt" : "thursdayReminderSentAt";

    await prisma.leagueWeekEmailConfig.upsert({
      where: {
        leagueId_nflSeasonYear_weekNumber: {
          leagueId,
          nflSeasonYear: data.nflSeasonYear,
          weekNumber: data.weekNumber,
        },
      },
      create: {
        leagueId,
        nflSeasonYear: data.nflSeasonYear,
        weekNumber: data.weekNumber,
        [reminderField]: sentAt,
      },
      update: {
        [reminderField]: sentAt,
      },
    });
  }

  const logLabel =
    sent > 0
      ? `[email] ${reminderType} reminder sent`
      : `[email] ${reminderType} reminder skipped — no outstanding members`;
  console.info(logLabel, {
    leagueName: data.leagueName,
    weekNumber: data.weekNumber,
    sent,
    failed,
    skipped,
  });

  return { sent, failed, skipped, sentAt };
}
