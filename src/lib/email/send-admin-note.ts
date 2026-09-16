import { createElement } from "react";

import { prisma } from "@/lib/db";
import {
  EMAIL_CIRCUIT_OPEN_CODE,
  createEmailCircuitBreaker,
  recordEmailSendFailure,
  recordEmailSendSuccess,
  type EmailCircuitBreaker,
} from "@/lib/email/circuit-breaker";
import { adminNoteLeagueUrl, adminNoteSubject } from "@/lib/email/admin-note";
import { LeagueNotFoundError } from "@/lib/email/get-tuesday-digest-data";
import {
  EMAIL_SEND_CONCURRENCY,
  mapWithConcurrency,
} from "@/lib/email/map-with-concurrency";
import { getResendFrom } from "@/lib/email/resend-from";
import { resend } from "@/lib/email/resend-client";
import { sendWithRetry } from "@/lib/email/send-with-retry";
import { getTestLeagueEmailMode } from "@/lib/email/test-league-email-mode";
import { AdminNoteEmail } from "@/lib/email/templates/AdminNoteEmail";
import { leaguePlayerMembershipWhere } from "@/lib/league/player-membership-where";
import { logEvent } from "@/lib/logging/log-event";

export async function sendAdminNote({
  leagueId,
  note,
  breaker: providedBreaker,
}: {
  leagueId: string;
  note: string;
  breaker?: EmailCircuitBreaker;
}): Promise<{
  sent: number;
  failed: number;
  sentAt: Date | null;
  suppressed: boolean;
  wouldSendCount: number;
}> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, isTestLeague: true },
  });

  if (!league) {
    throw new LeagueNotFoundError(leagueId);
  }

  const memberships = await prisma.leagueMembership.findMany({
    where: leaguePlayerMembershipWhere(leagueId),
    select: {
      id: true,
      user: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const members = memberships.map((m) => ({
    membershipId: m.id,
    email: m.user.email,
  }));

  const leagueUrl = adminNoteLeagueUrl(leagueId);
  const subject = adminNoteSubject(league.name, league.isTestLeague);

  if (league.isTestLeague && getTestLeagueEmailMode() === "suppress") {
    const wouldSendCount = members.length;
    const now = wouldSendCount > 0 ? new Date() : null;

    logEvent({
      level: "info",
      domain: "email",
      action: "admin_note_suppressed",
      leagueId,
      message: "admin note suppressed for test league",
      context: { wouldSendCount },
    });

    return {
      sent: 0,
      failed: 0,
      sentAt: now,
      suppressed: true,
      wouldSendCount,
    };
  }

  const breaker = providedBreaker ?? createEmailCircuitBreaker();

  if (breaker.open) {
    return {
      sent: 0,
      failed: members.length,
      sentAt: null,
      suppressed: false,
      wouldSendCount: 0,
    };
  }

  const sendId = crypto.randomUUID();
  let sent = 0;
  let failed = 0;

  await mapWithConcurrency(
    members,
    EMAIL_SEND_CONCURRENCY,
    async (member) => {
      try {
        await sendWithRetry(async () => {
          const { error } = await resend.emails.send(
            {
              from: getResendFrom(),
              to: [member.email],
              subject,
              react: createElement(AdminNoteEmail, {
                leagueName: league.name,
                note,
                leagueUrl,
                isTestLeague: league.isTestLeague,
              }),
            },
            {
              idempotencyKey: `admin-note:${leagueId}:${sendId}:${member.membershipId}`,
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
          message: "admin note member send failed",
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
            message: "admin note aborted remaining sends — Resend circuit open",
            context: {
              consecutiveFailures: breaker.consecutiveFailures,
              remainingAborted: true,
            },
          });
        }
      }
    },
    { shouldAbort: () => breaker.open },
  );

  const notAttempted = members.length - sent - failed;
  if (notAttempted > 0) {
    failed += notAttempted;
  }

  const sentAt = sent > 0 ? new Date() : null;
  const allFailed = sent === 0 && failed > 0;
  const partial = sent > 0 && failed > 0;

  logEvent({
    level: allFailed ? "error" : partial ? "warn" : "info",
    domain: "email",
    action: "admin_note_complete",
    leagueId,
    message: allFailed
      ? "admin note failed"
      : partial
        ? "admin note partially sent"
        : "admin note sent",
    context: {
      leagueName: league.name,
      sent,
      failed,
      circuitOpen: breaker.open,
    },
  });

  return { sent, failed, sentAt, suppressed: false, wouldSendCount: 0 };
}
