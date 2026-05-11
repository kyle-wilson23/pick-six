import nflTeams from "../../../prisma/data/nfl-teams.json";

/** Uppercase abbreviations that have a file under `public/nfl-logos/`. */
const NFL_LOGO_ABBREVIATIONS = new Set(
  nflTeams.map((t) => t.abbreviation.toUpperCase()),
);

/**
 * Map a team abbreviation to a public logo URL, or `null` when no asset exists
 * (caller should use abbreviation `Avatar` fallback).
 */
export function resolveNflLogoSrc(input: { abbreviation: string }): string | null {
  const raw = input.abbreviation?.trim();
  if (!raw) return null;
  const abbr = raw.toUpperCase().slice(0, 4);
  if (!NFL_LOGO_ABBREVIATIONS.has(abbr)) return null;
  return `/nfl-logos/${abbr}.png`;
}
