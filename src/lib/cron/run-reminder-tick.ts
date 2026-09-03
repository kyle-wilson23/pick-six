import "server-only";

import { getActiveLeagueIds } from "@/lib/cron/get-active-league-ids";
import {
  REMINDER_SLOTS,
  REMINDER_SLOT_SENT_AT_FIELD,
  shouldSendWeeklyReminder,
  summarizeReminderSkip,
  type ReminderSkipReason,
} from "@/lib/cron/should-send-weekly-reminder";
import { prisma } from "@/lib/db";
import { EMAIL_CIRCUIT_OPEN_CODE, createEmailCircuitBreaker } from "@/lib/email/circuit-breaker";
import {
  LeagueNotFoundError,
  NoActiveWeekError,
  getReminderData,
} from "@/lib/email/get-reminder-data";
import { sendReminder } from "@/lib/email/send-reminder";
import { logEvent } from "@/lib/logging/log-event";

export type ReminderTickResult = {
  processed: number;
  sent: number;
  skippedAlreadySent: number;
  skippedNoWeek: number;
  skippedPreview: number;
  skippedPastDeadline: number;
  skippedNotDue: number;
  skippedMissingDeadline: number;
  failed: number;
};

function emptyResult(): ReminderTickResult {
  return {
    processed: 0,
    sent: 0,
    skippedAlreadySent: 0,
    skippedNoWeek: 0,
    skippedPreview: 0,
    skippedPastDeadline: 0,
    skippedNotDue: 0,
    skippedMissingDeadline: 0,
    failed: 0,
  };
}

function countSkip(body: ReminderTickResult, reason: ReminderSkipReason): void {
  switch (reason) {
    case "already_sent":
      body.skippedAlreadySent += 1;
      break;
    case "not_due":
      body.skippedNotDue += 1;
      break;
    case "past_deadline":
      body.skippedPastDeadline += 1;
      break;
    case "missing_deadline":
      body.skippedMissingDeadline += 1;
      break;
  }
}

function skipLogCode(reason: ReminderSkipReason): string {
  switch (reason) {
    case "already_sent":
      return "CRON_REMINDER_ALREADY_SENT";
    case "not_due":
      return "CRON_REMINDER_NOT_DUE";
    case "past_deadline":
      return "CRON_PAST_DEADLINE";
    case "missing_deadline":
      return "CRON_REMINDER_MISSING_DEADLINE";
  }
}

/**
 * Shared per-league loop for both daily ticks. Evaluates slot 1 then slot 2 and stops after the
 * first slot that records a send (or that attempted a send with failures) so a tick never emits
 * two reminders for the same league. A no-recipient slot falls through so the later slot can still
 * fire the same tick.
 */
export async function runReminderTick(args: {
  route: string;
  now?: Date;
}): Promise<ReminderTickResult> {
  const { route } = args;
  const now = args.now ?? new Date();
  const leagueIds = await getActiveLeagueIds();
  const body = emptyResult();
  const breaker = createEmailCircuitBreaker();

  for (const leagueId of leagueIds) {
    if (breaker.open) {
      body.failed += 1;
      body.processed += 1;
      logEvent({
        level: "info",
        domain: "cron",
        route,
        action: "league_skipped_circuit_open",
        code: EMAIL_CIRCUIT_OPEN_CODE,
        leagueId,
        message: "reminder tick: league skipped — Resend circuit open for this invocation",
      });
      continue;
    }

    try {
      const data = await getReminderData({ leagueId }, now);

      if (data.isPreviewWeek) {
        body.skippedPreview += 1;
        body.processed += 1;
        logEvent({
          level: "info",
          domain: "cron",
          route,
          action: "preview_week_skip",
          code: "CRON_PREVIEW_WEEK",
          leagueId,
          message: "reminder tick: skipped — competition week not started (preview)",
          context: { weekNumber: data.weekNumber, nflSeasonYear: data.nflSeasonYear },
        });
        continue;
      }

      const existing = await prisma.leagueWeekEmailConfig.findUnique({
        where: {
          leagueId_nflSeasonYear_weekNumber: {
            leagueId,
            nflSeasonYear: data.nflSeasonYear,
            weekNumber: data.weekNumber,
          },
        },
        select: {
          wednesdayReminderSentAt: true,
          thursdayReminderSentAt: true,
        },
      });

      const skipReasons: ReminderSkipReason[] = [];
      let recordedSend = false;

      for (const slot of REMINDER_SLOTS) {
        const alreadySentAt = existing?.[REMINDER_SLOT_SENT_AT_FIELD[slot]] ?? null;
        const decision = shouldSendWeeklyReminder({
          slot,
          deadline: data.pickDeadlineUtc,
          now,
          alreadySentAt,
        });

        if (!decision.send) {
          skipReasons.push(decision.reason);
          if (decision.reason === "past_deadline" || decision.reason === "missing_deadline") {
            break;
          }
          continue;
        }

        const result = await sendReminder({
          leagueId,
          slot,
          preloadedData: data,
          breaker,
        });
        body.sent += result.sent;
        body.failed += result.failed;

        // Stamp or a real send attempt ends the tick for this league — one reminder max.
        // Zero outstanding members leave sentAt null so the later slot can still fire.
        if (result.sentAt != null || result.failed > 0 || result.sent > 0) {
          recordedSend = true;
          break;
        }
      }

      if (!recordedSend) {
        const reason = summarizeReminderSkip(skipReasons);
        if (reason != null) {
          countSkip(body, reason);
          logEvent({
            level: "info",
            domain: "cron",
            route,
            action: "league_skipped",
            code: skipLogCode(reason),
            leagueId,
            message: `reminder tick: skipped — ${reason}`,
            context: {
              reason,
              weekNumber: data.weekNumber,
              nflSeasonYear: data.nflSeasonYear,
              pickDeadlineUtc: data.pickDeadlineUtc?.toISOString() ?? null,
            },
          });
        }
      }
    } catch (e) {
      if (e instanceof NoActiveWeekError || e instanceof LeagueNotFoundError) {
        body.skippedNoWeek += 1;
        logEvent({
          level: "info",
          domain: "cron",
          route,
          action: "no_active_week",
          leagueId,
          message: "reminder tick: no active week for league",
        });
      } else {
        body.failed += 1;
        logEvent({
          level: "error",
          domain: "cron",
          route,
          action: "league_error",
          leagueId,
          message: "reminder tick: unhandled league error",
          context: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    }
    body.processed += 1;
  }

  return body;
}
