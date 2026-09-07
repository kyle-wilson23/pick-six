import "server-only";

import { isOnOrAfterEasternDayHour } from "@/lib/cron/eastern-window";
import {
  firstEligibleReminderTickUtc,
  isPastPickDeadline,
  reminderSlotAnchorUtc,
  type ReminderSlot,
} from "@/lib/cron/should-send-weekly-reminder";
import { prisma } from "@/lib/db";
import {
  LeagueNotFoundError,
  NoActiveWeekError,
  getTuesdayDigestData,
} from "@/lib/email/get-tuesday-digest-data";

export type EmailJobRowStatus =
  | { state: "sent"; sentAtIso: string }
  | { state: "skipped"; reason: "no_outstanding" | "no_completed_week" }
  | { state: "pending" }
  | { state: "not_sent" };

export type WeeklyEmailStatus = {
  weekNumber: number | null;
  nflSeasonYear: number;
  tuesdayDigest: EmailJobRowStatus;
  wednesdayReminder: EmailJobRowStatus;
  thursdayReminder: EmailJobRowStatus;
};

function inferTuesdayDigestStatus(
  sentAt: Date | null | undefined,
  now: Date,
  hasConcludedFirstCompetitionWeek: boolean,
): EmailJobRowStatus {
  if (sentAt != null) {
    return { state: "sent", sentAtIso: sentAt.toISOString() };
  }

  if (!hasConcludedFirstCompetitionWeek) {
    return { state: "skipped", reason: "no_completed_week" };
  }

  if (isOnOrAfterEasternDayHour(now, 3, 0)) {
    return { state: "not_sent" };
  }

  if (isOnOrAfterEasternDayHour(now, 2, 21)) {
    return { state: "not_sent" };
  }

  return { state: "pending" };
}

function inferReminderStatus(
  reminderSentAt: Date | null | undefined,
  outstandingCount: number,
  now: Date,
  slot: ReminderSlot,
  deadline: Date | null,
  isPreviewWeek: boolean,
): EmailJobRowStatus {
  if (reminderSentAt != null) {
    return { state: "sent", sentAtIso: reminderSentAt.toISOString() };
  }

  if (outstandingCount === 0) {
    return { state: "skipped", reason: "no_outstanding" };
  }

  // Cron skips preview weeks entirely — not a missed send.
  if (isPreviewWeek && !isPastPickDeadline(deadline, now)) {
    return { state: "pending" };
  }

  if (deadline == null || isPastPickDeadline(deadline, now)) {
    return { state: "not_sent" };
  }

  const firstTick = firstEligibleReminderTickUtc(reminderSlotAnchorUtc(slot, deadline));
  if (now.getTime() < firstTick.getTime()) {
    return { state: "pending" };
  }

  return { state: "not_sent" };
}

export async function getWeeklyEmailStatus(input: {
  leagueId: string;
  outstandingCount: number;
  now?: Date;
}): Promise<WeeklyEmailStatus> {
  const now = input.now ?? new Date();
  const pendingStatus: WeeklyEmailStatus = {
    weekNumber: null,
    nflSeasonYear: new Date().getFullYear(),
    tuesdayDigest: { state: "pending" },
    wednesdayReminder: { state: "pending" },
    thursdayReminder: { state: "pending" },
  };

  let digestData;
  try {
    digestData = await getTuesdayDigestData({ leagueId: input.leagueId }, now);
  } catch (e) {
    if (e instanceof NoActiveWeekError || e instanceof LeagueNotFoundError) {
      return pendingStatus;
    }
    throw e;
  }

  const config = await prisma.leagueWeekEmailConfig.findUnique({
    where: {
      leagueId_nflSeasonYear_weekNumber: {
        leagueId: input.leagueId,
        nflSeasonYear: digestData.nflSeasonYear,
        weekNumber: digestData.weekNumber,
      },
    },
    select: {
      sentAt: true,
      wednesdayReminderSentAt: true,
      thursdayReminderSentAt: true,
    },
  });

  return {
    weekNumber: digestData.weekNumber,
    nflSeasonYear: digestData.nflSeasonYear,
    tuesdayDigest: inferTuesdayDigestStatus(
      config?.sentAt,
      now,
      digestData.hasConcludedFirstCompetitionWeek,
    ),
    wednesdayReminder: inferReminderStatus(
      config?.wednesdayReminderSentAt,
      input.outstandingCount,
      now,
      1,
      digestData.pickDeadlineUtc,
      digestData.isPreviewWeek,
    ),
    thursdayReminder: inferReminderStatus(
      config?.thursdayReminderSentAt,
      input.outstandingCount,
      now,
      2,
      digestData.pickDeadlineUtc,
      digestData.isPreviewWeek,
    ),
  };
}
