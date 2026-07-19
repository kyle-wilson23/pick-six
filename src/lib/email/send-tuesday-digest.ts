import { createElement } from "react";

import { prisma } from "@/lib/db";
import {
  EMAIL_CIRCUIT_OPEN_CODE,
  createEmailCircuitBreaker,
  recordEmailSendFailure,
  recordEmailSendSuccess,
} from "@/lib/email/circuit-breaker";
import { getTuesdayDigestData, type TuesdayDigestData } from "@/lib/email/get-tuesday-digest-data";
import {
  EMAIL_SEND_CONCURRENCY,
  mapWithConcurrency,
} from "@/lib/email/map-with-concurrency";
import { getResendFrom } from "@/lib/email/resend-from";
import { resend } from "@/lib/email/resend-client";
import { sendWithRetry } from "@/lib/email/send-with-retry";
import { TuesdayDigestEmail } from "@/lib/email/templates/TuesdayDigestEmail";
import { logEvent } from "@/lib/logging/log-event";

export async function sendTuesdayDigest({
  leagueId,
  preloadedData,
}: {
  leagueId: string;
  preloadedData?: TuesdayDigestData;
}): Promise<{ sent: number; failed: number; sentAt: Date | null }> {
  const data = preloadedData ?? (await getTuesdayDigestData({ leagueId }));

  const config = await prisma.leagueWeekEmailConfig.findUnique({
    where: {
      leagueId_nflSeasonYear_weekNumber: {
        leagueId,
        nflSeasonYear: data.nflSeasonYear,
        weekNumber: data.weekNumber,
      },
    },
    select: { bodyText: true },
  });

  const adminNote = config?.bodyText ?? null;

  let sent = 0;
  let failed = 0;
  const breaker = createEmailCircuitBreaker();

  await mapWithConcurrency(data.members, EMAIL_SEND_CONCURRENCY, async (member) => {
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
            subject: `[${data.leagueName}] Week ${data.weekNumber} — Tuesday Update`,
            react: createElement(TuesdayDigestEmail, {
              leagueName: data.leagueName,
              weekNumber: data.weekNumber,
              standings: data.standings.map((s) => ({
                rank: s.rank,
                displayName: s.displayName,
                totalPoints: s.totalPoints,
                wins: s.wins,
                losses: s.losses,
              })),
              jailedTeamName: data.jailedTeamName,
              jailedTeamAbbreviation: data.jailedTeamAbbreviation,
              picksUrl: data.picksUrl,
              adminNote,
            }),
          },
          {
            idempotencyKey: `tuesday-digest:${leagueId}:${data.weekNumber}:${member.membershipId}`,
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
        message: "tuesday digest member send failed",
        context: {
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
          message: "tuesday digest aborted remaining sends — Resend circuit open",
          context: {
            consecutiveFailures: breaker.consecutiveFailures,
            remainingAborted: true,
          },
        });
      }
    }
  });

  const sentAt = sent > 0 ? new Date() : null;

  if (sentAt != null) {
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
        bodyText: adminNote,
        sentAt,
      },
      update: {
        sentAt,
      },
    });
  }

  logEvent({
    level: "info",
    domain: "email",
    action: "tuesday_digest_complete",
    leagueId,
    weekNumber: data.weekNumber,
    message: "tuesday digest sent",
    context: {
      leagueName: data.leagueName,
      sent,
      failed,
      circuitOpen: breaker.open,
    },
  });

  return { sent, failed, sentAt };
}
