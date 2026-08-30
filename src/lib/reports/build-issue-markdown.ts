import type { ReportLeague } from "./resolve-report-league";

export const ISSUE_TITLE_PREFIX = "[User report] ";
const TITLE_SNIPPET_MAX = 70;

export type ReportDevice = {
  userAgent: string;
  viewportWidth: number;
  viewportHeight: number;
  formFactor: "mobile" | "desktop";
};

export type BuildIssueMarkdownInput = {
  description: string;
  screenshotUrl?: string | null;
  user: { id: string; name: string; email: string };
  league: ReportLeague | null;
  visitTrail: readonly string[];
  device: ReportDevice;
};

export function buildIssueTitle(description: string): string {
  const snippet = description.trim().replace(/\s+/g, " ").slice(0, TITLE_SNIPPET_MAX);
  return `${ISSUE_TITLE_PREFIX}${snippet}`;
}

export function formFactorFromWidth(width: number): "mobile" | "desktop" {
  return width < 900 ? "mobile" : "desktop";
}

function leagueBlock(league: ReportLeague | null): string {
  if (!league) {
    return "(none)";
  }
  return `${league.name} (\`${league.id}\`)`;
}

function trailBlock(trail: readonly string[]): string {
  if (trail.length === 0) {
    return "(none)";
  }
  return trail.map((path) => `- \`${path}\``).join("\n");
}

export function buildIssueMarkdown(input: BuildIssueMarkdownInput): string {
  const screenshot = input.screenshotUrl
    ? `\n![screenshot](${input.screenshotUrl})\n`
    : "";

  return [
    "## Description",
    "",
    input.description.trim(),
    screenshot,
    "## User",
    "",
    `- id: \`${input.user.id}\``,
    `- name: ${input.user.name}`,
    `- email: ${input.user.email}`,
    "",
    "## League",
    "",
    leagueBlock(input.league),
    "",
    "## Visit trail",
    "",
    trailBlock(input.visitTrail),
    "",
    "## Device",
    "",
    `- userAgent: \`${input.device.userAgent}\``,
    `- viewport: ${input.device.viewportWidth}x${input.device.viewportHeight}`,
    `- formFactor: ${input.device.formFactor}`,
    "",
  ].join("\n");
}
