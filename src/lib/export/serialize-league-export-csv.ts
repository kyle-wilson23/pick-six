import "server-only";

import type { LeagueExportData } from "@/lib/export/build-league-export-data";

const REGULAR_SEASON_WEEKS = 18;

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

export function serializeLeagueExportCsv(data: LeagueExportData): string {
  const weekHeaders = Array.from({ length: REGULAR_SEASON_WEEKS }, (_, index) => `Week ${index + 1}`);
  const headerRow1 = csvRow(["Email", ...weekHeaders, "Total Points"]);

  const jailedLabels = data.jailedByWeek
    .slice(0, REGULAR_SEASON_WEEKS)
    .map((week) => week.exportTeamLabel);
  while (jailedLabels.length < REGULAR_SEASON_WEEKS) {
    jailedLabels.push("");
  }
  const headerRow2 = csvRow(["", ...jailedLabels, ""]);

  const participantRows = data.participants.map((participant) => {
    const weekCells = Array.from({ length: REGULAR_SEASON_WEEKS }, (_, index) => {
      const weekNumber = index + 1;
      return participant.picksByWeek.get(weekNumber)?.exportTeamLabel ?? "";
    });
    return csvRow([participant.email, ...weekCells, String(participant.totalPoints)]);
  });

  return [headerRow1, headerRow2, ...participantRows].join("\n");
}
