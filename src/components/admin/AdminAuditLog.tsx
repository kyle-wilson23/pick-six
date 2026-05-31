import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { AuditLogEntryView } from "@/lib/admin/get-audit-log";

export type AdminAuditLogProps = {
  entries: AuditLogEntryView[];
};

function formatTimestamp(isoUtc: string): string {
  const d = new Date(isoUtc);
  return isNaN(d.getTime()) ? isoUtc : d.toLocaleString();
}

function buildActionLine(entry: AuditLogEntryView): string {
  if (entry.beforeTeamName == null) {
    return `${entry.adminName} submitted first pick for ${entry.targetName} (Week ${entry.nflWeekNumber})`;
  }
  return `${entry.adminName} changed ${entry.targetName}'s pick (Week ${entry.nflWeekNumber})`;
}

function formatTeamLabel(teamName: string, antiJailed: boolean): string {
  return antiJailed ? `${teamName} (+anti-jailed)` : teamName;
}

function buildTeamChangeLine(entry: AuditLogEntryView): string {
  const afterLabel = formatTeamLabel(entry.afterTeamName, entry.afterAntiJailed);

  if (entry.beforeTeamName == null) {
    return `first pick → ${afterLabel}`;
  }

  const beforeLabel = formatTeamLabel(
    entry.beforeTeamName,
    entry.beforeAntiJailed ?? false,
  );
  return `${beforeLabel} → ${afterLabel}`;
}

export function AdminAuditLog({ entries }: AdminAuditLogProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6" component="h2">
        Override Audit Trail
      </Typography>

      {entries.length === 0 ? (
        <Typography color="text.secondary">No override actions recorded yet.</Typography>
      ) : (
        <Stack spacing={1.5} aria-label="Override audit trail">
          {entries.map((entry) => (
            <Paper key={entry.id} variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Typography variant="body2">{buildActionLine(entry)}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {buildTeamChangeLine(entry)}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {formatTimestamp(entry.createdAt)}
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
