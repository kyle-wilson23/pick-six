import "server-only";

import nflTeams from "../../../prisma/data/nfl-teams.json";

/** Legacy spreadsheet nicknames; overrides last-word extraction where the sheet used a shorter label. */
const LEGACY_LABEL_OVERRIDES: Record<string, string> = {
  TB: "Bucs",
};

function nicknameFromFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? fullName;
}

const EXPORT_LABEL_BY_ABBREVIATION: Record<string, string> = Object.fromEntries(
  (nflTeams as Array<{ abbreviation: string; name: string }>).map(({ abbreviation, name }) => [
    abbreviation,
    LEGACY_LABEL_OVERRIDES[abbreviation] ?? nicknameFromFullName(name),
  ]),
);

/**
 * Maps an NFL team to the legacy short label used in Kyle's manual league spreadsheet.
 * Falls back to the last word of `fullName` when `abbreviation` is not in the canonical map.
 */
export function teamNameForExport(abbreviation: string, fullName: string): string {
  const mapped = EXPORT_LABEL_BY_ABBREVIATION[abbreviation];
  if (mapped != null) return mapped;
  return nicknameFromFullName(fullName);
}
