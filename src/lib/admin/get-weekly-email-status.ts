import "server-only";

import {
  isBeforeEasternDayHour,
  isInEasternWindow,
  isOnOrAfterEasternDayHour,
} from "@/lib/cron/eastern-window";
import { prisma } from "@/lib/db";
import {
  LeagueNotFoundError,
  NoActiveWeekError,
  getTuesdayDigestData,
} from "@/lib/email/get-tuesday-digest-data";

export type EmailJobRowStatus =
  | { state: "sent"; sentAtIso: string }
  | { state: "skipped"; reason: "no_outstanding" }
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
): EmailJobRowStatus {
  if (sentAt != null) {
    return { state: "sent", sentAtIso: sentAt.toISOString() };
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
  windowDay: number,
  windowStartHour: number,
  windowEndHour: number,
  notSentAfterDay: number,
): EmailJobRowStatus {
  if (reminderSentAt != null) {
    return { state: "sent", sentAtIso: reminderSentAt.toISOString() };
  }

  if (outstandingCount === 0) {
    return { state: "skipped", reason: "no_outstanding" };
  }

  const beforeWindow =
    !isInEasternWindow(now, windowDay, windowStartHour, windowEndHour) &&
    isBeforeEasternDayHour(now, windowDay, windowStartHour);

  if (beforeWindow) {
    return { state: "pending" };
  }

  if (isOnOrAfterEasternDayHour(now, notSentAfterDay, 0)) {
    return { state: "not_sent" };
  }

  return { state: "pending" };
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
    digestData = await getTuesdayDigestData({ leagueId: input.leagueId });
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
    tuesdayDigest: inferTuesdayDigestStatus(config?.sentAt, now),
    wednesdayReminder: inferReminderStatus(
      config?.wednesdayReminderSentAt,
      input.outstandingCount,
      now,
      3,
      19,
      24,
      4,
    ),
    thursdayReminder: inferReminderStatus(
      config?.thursdayReminderSentAt,
      input.outstandingCount,
      now,
      4,
      17,
      21,
      5,
    ),
  };
}
