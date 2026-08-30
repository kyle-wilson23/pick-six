import "server-only";

import { getGitHubReportsRepo, getGitHubReportsToken } from "@/lib/reports/reports-config";

export class GitHubIssueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubIssueError";
  }
}

export type CreateGitHubIssueInput = {
  title: string;
  body: string;
};

export async function createGitHubIssue(input: CreateGitHubIssueInput): Promise<void> {
  const token = getGitHubReportsToken();
  const repo = getGitHubReportsRepo();
  if (!token || !repo) {
    throw new GitHubIssueError("GitHub reports is not configured");
  }

  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "pick-six-reports",
    },
    body: JSON.stringify({ title: input.title, body: input.body }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new GitHubIssueError(
      `GitHub issues API ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }
}
