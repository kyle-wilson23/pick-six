import "server-only";

/**
 * Sanitizes a league name for use in a CSV download filename.
 * Non-alphanumeric characters become hyphens; repeated hyphens collapse; max 64 chars.
 */
export function sanitizeDownloadFilenameSegment(name: string): string {
  const sanitized = name
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (sanitized.length === 0) return "league";
  return sanitized.slice(0, 64);
}
