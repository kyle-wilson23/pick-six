import { createElement } from "react";

import { prisma } from "@/lib/db";
import {
  EMAIL_CIRCUIT_OPEN_CODE,
  createEmailCircuitBreaker,
  recordEmailSendFailure,
  recordEmailSendSuccess,
} from "@/lib/email/circuit-breaker";
import { getReminderData, type ReminderData } from "@/lib/email/get-reminder-data";
import {
  EMAIL_SEND_CONCURRENCY,
  mapWithConcurrency,
} from "@/lib/email/map-with-concurrency";
import { getResendFrom } from "@/lib/email/resend-from";
import { resend } from "@/lib/email/resend-client";
import { sendWithRetry } from "@/lib/email/send-with-retry";
import { ReminderEmail } from "@/lib/email/templates/ReminderEmail";
import { logEvent } from "@/lib/logging/log-event";

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
  const breaker = createEmailCircuitBreaker();

  await mapWithConcurrency(
    data.outstandingMembers,
    EMAIL_SEND_CONCURRENCY,
    async (member) => {
      if (breaker.open) {
        failed += 1;
        return;
      }

      try {
        await sendWithRetry(async () => {
          const { error } = await resend.emails.send(
            {
              from: getResendFrom(),
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
        recordEmailSendSuccess(breaker);
      } catch (err) {
        failed += 1;
        logEvent({
          level: "error",
          domain: "email",
          action: "member_send_failed",
          code: "EMAIL_SEND_FAILED",
          leagueId,
          weekNumber: data.weekNumber,
          message: `${reminderType} reminder member send failed`,
          context: {
            reminderType,
            membershipId: member.membershipId,
            error: err instanceof Error ? err.message : String(err),
          },
        });

        if (recordEmailSendFailure(breaker)) {
          logEvent({
            level: "error",
            domain: "email",
            action: "circuit_open",
            code: EMAIL_CIRCUIT_OPEN_CODE,
            leagueId,
            weekNumber: data.weekNumber,
            message: `${reminderType} reminder aborted remaining sends — Resend circuit open`,
            context: {
              reminderType,
              consecutiveFailures: breaker.consecutiveFailures,
              remainingAborted: true,
            },
          });
        }
      }
    },
  );

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

  logEvent({
    level: "info",
    domain: "email",
    action: sent > 0 ? "reminder_complete" : "reminder_skipped",
    leagueId,
    weekNumber: data.weekNumber,
    message:
      sent > 0
        ? `${reminderType} reminder sent`
        : `${reminderType} reminder skipped — no outstanding members`,
    context: {
      reminderType,
      leagueName: data.leagueName,
      sent,
      failed,
      skipped,
      circuitOpen: breaker.open,
    },
  });

  return { sent, failed, skipped, sentAt };
}
