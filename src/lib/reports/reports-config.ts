const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function getGitHubReportsToken(): string | null {
  const token = process.env.GITHUB_TOKEN?.trim();
  return token || null;
}

export function getGitHubReportsRepo(): string | null {
  const repo = process.env.GITHUB_REPORTS_REPO?.trim();
  if (!repo || !REPO_PATTERN.test(repo)) {
    return null;
  }
  return repo;
}

export function isGitHubReportsConfigured(): boolean {
  return Boolean(getGitHubReportsToken() && getGitHubReportsRepo());
}

export function getReportsOperatorEmail(): string | null {
  const email = process.env.REPORTS_OPERATOR_EMAIL?.trim();
  if (!email || !email.includes("@")) {
    return null;
  }
  return email;
}

export function isOperatorEmailConfigured(): boolean {
  return getReportsOperatorEmail() != null;
}
