"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import Stack from "@mui/material/Stack";

import { AdminPickOverrideDialog } from "@/components/admin/AdminPickOverrideDialog";
import { AdminSubmissionCard } from "@/components/admin/AdminSubmissionCard";
import type { AdminOverrideData } from "@/lib/admin/build-admin-override-data";
import type { AdminSubmissionStatusParticipant } from "@/lib/admin/build-submission-status";
import { isAdminSubmittedPickVisible } from "@/lib/admin/submitted-pick";

export type AdminDashboardClientProps = {
  leagueId: string;
  weekNumber: number;
  participants: AdminSubmissionStatusParticipant[];
  overrideData: AdminOverrideData;
};

type OverrideTarget = {
  membershipId: string;
  displayName: string;
  currentPick: {
    teamId: string;
    teamName: string;
    antiJailedBonus: boolean;
  } | null;
};

export function AdminDashboardClient({
  leagueId,
  weekNumber,
  participants,
  overrideData,
}: AdminDashboardClientProps) {
  const router = useRouter();
  const [overrideTarget, setOverrideTarget] = useState<OverrideTarget | null>(null);

  const handleOverrideSuccess = useCallback(() => {
    router.refresh();
    setOverrideTarget(null);
  }, [router]);

  function openOverride(participant: AdminSubmissionStatusParticipant) {
    let currentPick: OverrideTarget["currentPick"] = null;
    if (overrideData.pickWindowClosed) {
      const weekPick = overrideData.allSeasonPicks.find(
        (p) => p.membershipId === participant.membershipId && p.nflWeekNumber === weekNumber,
      );

      if (weekPick) {
        const visiblePick = isAdminSubmittedPickVisible(participant.submittedPick)
          ? participant.submittedPick
          : null;
        const teamName =
          visiblePick?.teamName ??
          overrideData.games
            .flatMap((g) => [
              { id: g.homeTeamId, name: g.homeTeamName },
              { id: g.awayTeamId, name: g.awayTeamName },
            ])
            .find((t) => t.id === weekPick.teamId)?.name ??
          weekPick.teamId;
        currentPick = {
          teamId: weekPick.teamId,
          teamName,
          antiJailedBonus: visiblePick?.antiJailedBonus ?? false,
        };
      }
    }

    setOverrideTarget({
      membershipId: participant.membershipId,
      displayName: participant.displayName,
      currentPick,
    });
  }

  const priorPickTeamIds =
    overrideTarget == null
      ? []
      : overrideData.allSeasonPicks
          .filter(
            (p) =>
              p.membershipId === overrideTarget.membershipId && p.nflWeekNumber !== weekNumber,
          )
          .map((p) => p.teamId);

  return (
    <>
      <Stack spacing={1.5} aria-label="Participant submission status">
        {participants.map((participant) => (
          <AdminSubmissionCard
            key={participant.membershipId}
            displayName={participant.displayName}
            imageUrl={participant.imageUrl}
            submittedPick={participant.submittedPick}
            onOverride={() => openOverride(participant)}
          />
        ))}
      </Stack>

      {overrideTarget != null && (
        <AdminPickOverrideDialog
          open
          onClose={() => setOverrideTarget(null)}
          onSuccess={handleOverrideSuccess}
          leagueId={leagueId}
          weekNumber={weekNumber}
          targetMembershipId={overrideTarget.membershipId}
          displayName={overrideTarget.displayName}
          currentPick={overrideTarget.currentPick}
          pickWindowClosed={overrideData.pickWindowClosed}
          weekGames={overrideData.games}
          jailedTeamId={overrideData.jailedTeamId}
          priorPickTeamIds={priorPickTeamIds}
        />
      )}
    </>
  );
}
