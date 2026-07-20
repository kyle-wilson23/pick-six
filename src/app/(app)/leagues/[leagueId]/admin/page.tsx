import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LeagueMembershipRole } from "@prisma/client";
import { notFound } from "next/navigation";

import { AdminAuditLog } from "@/components/admin/AdminAuditLog";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";
import { AdminEmailComposer } from "@/components/admin/AdminEmailComposer";
import { AdminExportCsvButton } from "@/components/admin/AdminExportCsvButton";
import { AdminJailedVerification } from "@/components/admin/AdminJailedVerification";
import { AdminReminderControls } from "@/components/admin/AdminReminderControls";
import { AdminSimulationControls } from "@/components/admin/AdminSimulationControls";
import { AdminSubmissionCard } from "@/components/admin/AdminSubmissionCard";
import { AdminWeeklyEmailStatus } from "@/components/admin/AdminWeeklyEmailStatus";
import { auth } from "@/lib/auth";
import { buildAdminOverrideData } from "@/lib/admin/build-admin-override-data";
import { getAuditLog } from "@/lib/admin/get-audit-log";
import { getJailedVerification } from "@/lib/admin/get-jailed-verification";
import { getWeeklyEmailStatus } from "@/lib/admin/get-weekly-email-status";
import {
  buildSubmissionStatus,
  type AdminSubmissionStatusPayload,
} from "@/lib/admin/build-submission-status";
import { prisma } from "@/lib/db";
import { getLeagueAccess } from "@/lib/league/get-league-access";
import { resolveCurrentSeasonForLeague } from "@/lib/league/resolve-current-season";
import { logEvent } from "@/lib/logging/log-event";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueAdminDashboardPage({ params }: PageProps) {
  const { leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const access = await getLeagueAccess(session.user.id, leagueId);
  if (!access || access.membership.role !== LeagueMembershipRole.ADMIN) {
    notFound();
  }

  const { league } = access;

  let payload: AdminSubmissionStatusPayload;
  let overrideData: Awaited<ReturnType<typeof buildAdminOverrideData>>;
  let auditEntries: Awaited<ReturnType<typeof getAuditLog>>;
  let season: Awaited<ReturnType<typeof resolveCurrentSeasonForLeague>>;
  try {
    [payload, overrideData, auditEntries, season] = await Promise.all([
      buildSubmissionStatus({ leagueId }),
      buildAdminOverrideData({ leagueId }),
      getAuditLog({ leagueId }),
      resolveCurrentSeasonForLeague(prisma.season, leagueId),
    ]);
  } catch {
    notFound();
  }

  const jailedVerification = await getJailedVerification({ leagueId }).catch(() => null);

  const { weekNumber, participants } = payload;
  const showOverrideUi = overrideData != null && weekNumber != null;
  const outstandingCount = participants.filter((p) => p.submittedPick === null).length;
  const allSubmitted =
    weekNumber != null && participants.length > 0 && outstandingCount === 0;

  let weeklyEmailStatus: Awaited<ReturnType<typeof getWeeklyEmailStatus>> | undefined;
  let weeklyEmailStatusError = false;
  try {
    weeklyEmailStatus = await getWeeklyEmailStatus({
      leagueId,
      outstandingCount,
    });
  } catch (e) {
    weeklyEmailStatusError = true;
    logEvent({
      level: "error",
      domain: "api",
      route: `/leagues/${leagueId}/admin`,
      action: "weekly_email_status_failed",
      leagueId,
      message: "failed to load weekly email status for admin card",
      context: { error: e instanceof Error ? e.message : String(e) },
    });
  }

  return (
    <Stack
      component="main"
      id="main-content"
      tabIndex={-1}
      spacing={3}
      sx={{
        ...skipTargetMainSx,
        minHeight: "100vh",
        px: 2,
        py: 4,
        maxWidth: { xs: 640, md: 1024 },
        mx: "auto",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "flex-start" }}
        justifyContent="space-between"
      >
        <Typography variant="h4" component="h1">
          {weekNumber != null ? `Week ${weekNumber} — Submission Status` : "No active week"}
        </Typography>
        <AdminExportCsvButton leagueId={leagueId} />
      </Stack>

      {allSubmitted ? (
        <Typography variant="body1" color="success.main">
          All participants have submitted picks this week
        </Typography>
      ) : null}

      {league.isTestLeague && season ? (
        <AdminSimulationControls
          leagueId={leagueId}
          firstCompetitionWeek={season.firstCompetitionWeek}
          simulationWeekCount={season.simulationWeekCount}
          simulatedCurrentWeek={season.simulatedCurrentWeek}
        />
      ) : null}

      <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="stretch">
        <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
          {weekNumber == null ? (
            <Typography variant="body2" color="text.secondary">
              Pick submission status will appear here once the season is initialized and game
              schedule data is available.
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

        <Stack spacing={3} sx={{ flex: 1, minWidth: 0 }}>
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

          <AdminWeeklyEmailStatus
            status={weeklyEmailStatus}
            loadError={weeklyEmailStatusError}
          />
        </Stack>
      </Stack>

      <AdminJailedVerification
        verification={jailedVerification}
        weekNumber={weekNumber}
      />

      <AdminAuditLog entries={auditEntries} />
    </Stack>
  );
}
