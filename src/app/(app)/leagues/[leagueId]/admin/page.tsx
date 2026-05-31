import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LeagueMembershipRole } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";
import { AdminSubmissionCard } from "@/components/admin/AdminSubmissionCard";
import { auth } from "@/lib/auth";
import { buildAdminOverrideData } from "@/lib/admin/build-admin-override-data";
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
  try {
    [payload, overrideData] = await Promise.all([
      buildSubmissionStatus({ leagueId }),
      buildAdminOverrideData({ leagueId }),
    ]);
  } catch {
    notFound();
  }

  const { weekNumber, participants } = payload;
  const showOverrideUi = overrideData != null && weekNumber != null;

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
    </Stack>
  );
}
