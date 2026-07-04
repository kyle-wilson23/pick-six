import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LeagueMembershipRole } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminAuditLog } from "@/components/admin/AdminAuditLog";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";
import { AdminEmailComposer } from "@/components/admin/AdminEmailComposer";
import { AdminJailedVerification } from "@/components/admin/AdminJailedVerification";
import { AdminReminderControls } from "@/components/admin/AdminReminderControls";
import { AdminSubmissionCard } from "@/components/admin/AdminSubmissionCard";
import { auth } from "@/lib/auth";
import { buildAdminOverrideData } from "@/lib/admin/build-admin-override-data";
import { getAuditLog } from "@/lib/admin/get-audit-log";
import { getJailedVerification } from "@/lib/admin/get-jailed-verification";
import {
  buildSubmissionStatus,
  type AdminSubmissionStatusPayload,
} from "@/lib/admin/build-submission-status";
import { prisma } from "@/lib/db";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueAdminDashboardPage({ params }: PageProps) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });

  if (!membership) {
    notFound();
  }

  if (membership.role !== LeagueMembershipRole.ADMIN) {
    notFound();
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true },
  });

  if (!league) {
    notFound();
  }

  let payload: AdminSubmissionStatusPayload;
  let overrideData: Awaited<ReturnType<typeof buildAdminOverrideData>>;
  let auditEntries: Awaited<ReturnType<typeof getAuditLog>>;
  try {
    [payload, overrideData, auditEntries] = await Promise.all([
      buildSubmissionStatus({ leagueId }),
      buildAdminOverrideData({ leagueId }),
      getAuditLog({ leagueId }),
    ]);
  } catch {
    notFound();
  }

  const jailedVerification = await getJailedVerification({ leagueId }).catch(() => null);

  const { weekNumber, participants } = payload;
  const showOverrideUi = overrideData != null && weekNumber != null;
  const outstandingCount = participants.filter((p) => p.submittedPick === null).length;

  return (
    <Stack
      component="main"
      spacing={3}
      sx={{
        minHeight: "100vh",
        px: 2,
        py: 4,
        maxWidth: 640,
        mx: "auto",
      }}
    >
      <Typography variant="body2">
        <Link href={`/leagues/${leagueId}`}>← {league.name}</Link>
      </Typography>

      <Typography variant="h4" component="h1">
        {weekNumber != null ? `Week ${weekNumber} — Submission Status` : "No active week"}
      </Typography>

      {weekNumber == null ? (
        <Typography variant="body2" color="text.secondary">
          Pick submission status will appear here once the season is initialized and game schedule
          data is available.
        </Typography>
      ) : participants.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No participants found for this league.
        </Typography>
      ) : showOverrideUi && overrideData != null ? (
        <AdminDashboardClient
          leagueId={leagueId}
          weekNumber={overrideData.weekNumber}
          participants={participants}
          overrideData={overrideData}
        />
      ) : (
        <Stack spacing={1.5} aria-label="Participant submission status">
          {participants.map((participant) => (
            <AdminSubmissionCard
              key={participant.membershipId}
              displayName={participant.displayName}
              submittedPick={participant.submittedPick}
            />
          ))}
        </Stack>
      )}

      <AdminJailedVerification
        verification={jailedVerification}
        weekNumber={weekNumber}
      />

      <Stack spacing={1}>
        <Typography variant="h5" component="h2">
          Weekly Email
        </Typography>
        <AdminEmailComposer leagueId={leagueId} weekNumber={weekNumber} />
      </Stack>

      <Stack spacing={1}>
        <Typography variant="h5" component="h2">
          Reminder Emails
        </Typography>
        <AdminReminderControls
          leagueId={leagueId}
          weekNumber={weekNumber}
          outstandingCount={outstandingCount}
        />
      </Stack>

      <AdminAuditLog entries={auditEntries} />
    </Stack>
  );
}
