import { createElement } from "react";

import { prisma } from "@/lib/db";
import { getTuesdayDigestData, type TuesdayDigestData } from "@/lib/email/get-tuesday-digest-data";
import { getResendFrom } from "@/lib/email/resend-from";
import { resend } from "@/lib/email/resend-client";
import { sendWithRetry } from "@/lib/email/send-with-retry";
import { TuesdayDigestEmail } from "@/lib/email/templates/TuesdayDigestEmail";

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

  for (const member of data.members) {
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
    } catch (err) {
      failed += 1;
      console.error("[email] tuesday digest member send failed", {
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

  console.info("[email] tuesday digest sent", {
    leagueName: data.leagueName,
    weekNumber: data.weekNumber,
    sent,
    failed,
  });

  return { sent, failed, sentAt };
}
