import { createElement } from "react";

import {
  REMINDER_SLOT_SENT_AT_FIELD,
  type ReminderSlot,
} from "@/lib/cron/should-send-weekly-reminder";
import { prisma } from "@/lib/db";
import {
  EMAIL_CIRCUIT_OPEN_CODE,
  createEmailCircuitBreaker,
  recordEmailSendFailure,
  recordEmailSendSuccess,
  type EmailCircuitBreaker,
} from "@/lib/email/circuit-breaker";
import { getReminderData, type ReminderData } from "@/lib/email/get-reminder-data";
import {
  EMAIL_SEND_CONCURRENCY,
  mapWithConcurrency,
} from "@/lib/email/map-with-concurrency";
import { getResendFrom } from "@/lib/email/resend-from";
import { resend } from "@/lib/email/resend-client";
import { sendWithRetry } from "@/lib/email/send-with-retry";
import { formatEmailSubject } from "@/lib/email/test-league-labeling";
import { getTestLeagueEmailMode } from "@/lib/email/test-league-email-mode";
import { ReminderEmail } from "@/lib/email/templates/ReminderEmail";
import { logEvent } from "@/lib/logging/log-event";

function reminderSubject(data: ReminderData, slot: ReminderSlot): string {
  const base =
    slot === 1
      ? `[${data.leagueName}] Week ${data.weekNumber} — Don't Forget Your Pick`
      : `[${data.leagueName}] Week ${data.weekNumber} — Last Call Before Picks Lock`;
  return formatEmailSubject(base, data.isTestLeague);
}

/** Resend idempotency keys stay on the historical weekday prefix so retries cannot double-send. */
function slotIdempotencyType(slot: ReminderSlot): "wednesday" | "thursday" {
  return slot === 1 ? "wednesday" : "thursday";
}

export async function sendReminder({
  leagueId,
  slot,
  preloadedData,
  breaker: providedBreaker,
}: {
  leagueId: string;
  /** 1 = heads-up (`deadline − 48h`), 2 = last call (`deadline − 12h`). */
  slot: ReminderSlot;
  preloadedData?: ReminderData;
  /**
   * Shared circuit breaker for a multi-league cron invocation — pass the same
   * instance across leagues so an open circuit aborts the rest of the run, not
   * just this league. Defaults to a fresh per-call breaker for single-league
   * callers (e.g. the admin manual-send route).
   */
  breaker?: EmailCircuitBreaker;
}): Promise<{
  sent: number;
  failed: number;
  skipped: number;
  sentAt: Date | null;
  suppressed: boolean;
  wouldSendCount: number;
}> {
  const data = preloadedData ?? (await getReminderData({ leagueId }));

  const skipped = data.submittedCount;

  if (data.isTestLeague && getTestLeagueEmailMode() === "suppress") {
    const wouldSendCount = data.outstandingMembers.length;
    // Only record the reminder's sentAt when there's actually something that
    // would have been sent — mirrors the real-send path, which likewise only
    // upserts when sent > 0, so a suppressed no-recipient run doesn't falsely
    // mark the reminder as "sent."
    const now = wouldSendCount > 0 ? new Date() : null;
    const reminderField = REMINDER_SLOT_SENT_AT_FIELD[slot];

    if (now != null) {
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
          [reminderField]: now,
        },
        update: {
          [reminderField]: now,
        },
      });
    }

    logEvent({
      level: "info",
      domain: "email",
      action: "reminder_suppressed",
      leagueId,
      weekNumber: data.weekNumber,
      message: `slot ${slot} reminder suppressed for test league`,
      context: {
        slot,
        wouldSendCount,
      },
    });

    return {
      sent: 0,
      failed: 0,
      skipped,
      sentAt: now,
      suppressed: true,
      wouldSendCount,
    };
  }

  const breaker = providedBreaker ?? createEmailCircuitBreaker();

  if (breaker.open) {
    // Circuit already open from an earlier league in this invocation — abort
    // this league entirely without attempting any member sends.
    return {
      sent: 0,
      failed: data.outstandingMembers.length,
      skipped,
      sentAt: null,
      suppressed: false,
      wouldSendCount: 0,
    };
  }

  let sent = 0;
  let failed = 0;

  await mapWithConcurrency(
    data.outstandingMembers,
    EMAIL_SEND_CONCURRENCY,
    async (member) => {
      try {
        await sendWithRetry(async () => {
          const { error } = await resend.emails.send(
            {
              from: getResendFrom(),
              to: [member.email],
              subject: reminderSubject(data, slot),
              react: createElement(ReminderEmail, {
                leagueName: data.leagueName,
                weekNumber: data.weekNumber,
                recipientDisplayName: member.displayName,
                jailedTeamName: data.jailedTeamName,
                jailedTeamAbbreviation: data.jailedTeamAbbreviation,
                picksUrl: data.picksUrl,
                slot,
                pickDeadlineUtc: data.pickDeadlineUtc,
                isTestLeague: data.isTestLeague,
              }),
            },
            {
              idempotencyKey: `${slotIdempotencyType(slot)}-reminder:${leagueId}:${data.weekNumber}:${member.membershipId}`,
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
          message: `slot ${slot} reminder member send failed`,
          context: {
            slot,
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
            message: `slot ${slot} reminder aborted remaining sends — Resend circuit open`,
            context: {
              slot,
              consecutiveFailures: breaker.consecutiveFailures,
              remainingAborted: true,
            },
          });
        }
      }
    },
    { shouldAbort: () => breaker.open },
  );

  // Members the pool never reached because the circuit opened mid-run — count
  // them as failed too (AC5: "count remaining as failed/skipped consistently").
  const notAttempted = data.outstandingMembers.length - sent - failed;
  if (notAttempted > 0) {
    failed += notAttempted;
  }

  const sentAt = sent > 0 ? new Date() : null;

  if (sentAt != null) {
    const reminderField = REMINDER_SLOT_SENT_AT_FIELD[slot];

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
        ? `slot ${slot} reminder sent`
        : `slot ${slot} reminder skipped — no outstanding members`,
    context: {
      slot,
      leagueName: data.leagueName,
      sent,
      failed,
      skipped,
      circuitOpen: breaker.open,
    },
  });

  return { sent, failed, skipped, sentAt, suppressed: false, wouldSendCount: 0 };
}
