import type { AvatarAllowedMime } from "@/lib/avatar";

import {
  buildIssueMarkdown,
  buildIssueTitle,
  formFactorFromWidth,
  type ReportDevice,
} from "./build-issue-markdown";
import type { ReportLeague } from "./resolve-report-league";
import { REPORT_DESCRIPTION_MAX } from "./report-form-schema";

export type ReporterIdentity = {
  id: string;
  name: string | null;
  email: string;
};

export type SubmitUserReportInput = {
  userId: string;
  description: string;
  visitTrail: string[];
  currentPathname: string;
  userAgent: string;
  viewportWidth: number;
  viewportHeight: number;
  screenshot?: { bytes: Uint8Array; contentType: AvatarAllowedMime } | null;
};

export type SubmitUserReportSuccess = {
  ok: true;
  screenshotOmitted?: boolean;
  githubFallback?: boolean;
};

export type SubmitUserReportFailure = {
  ok: false;
  httpStatus: 400 | 500 | 502;
  code: "VALIDATION_ERROR" | "DELIVERY_FAILED" | "CONFIG_ERROR";
  message: string;
};

export type SubmitUserReportResult = SubmitUserReportSuccess | SubmitUserReportFailure;

export type SubmitUserReportDeps = {
  resolveLeague: (userId: string, pathname: string) => Promise<ReportLeague | null>;
  loadUser: (userId: string) => Promise<ReporterIdentity | null>;
  githubConfigured: () => boolean;
  operatorConfigured: () => boolean;
  uploadScreenshot: (input: {
    userId: string;
    bytes: Uint8Array;
    contentType: AvatarAllowedMime;
  }) => Promise<string>;
  createIssue: (input: { title: string; body: string }) => Promise<void>;
  sendOperatorFallback: (input: {
    title: string;
    body: string;
    githubError: string;
  }) => Promise<void>;
  sendReceipt: (input: { to: string; userId: string }) => Promise<void>;
};

function displayName(user: ReporterIdentity): string {
  const name = user.name?.trim();
  return name && name.length > 0 ? name : "(none)";
}

function deviceFromInput(input: SubmitUserReportInput): ReportDevice {
  return {
    userAgent: input.userAgent,
    viewportWidth: input.viewportWidth,
    viewportHeight: input.viewportHeight,
    formFactor: formFactorFromWidth(input.viewportWidth),
  };
}

export async function submitUserReport(
  input: SubmitUserReportInput,
  deps: SubmitUserReportDeps,
): Promise<SubmitUserReportResult> {
  const description = input.description.trim();
  if (!description) {
    return {
      ok: false,
      httpStatus: 400,
      code: "VALIDATION_ERROR",
      message: "Please describe the problem.",
    };
  }
  if (description.length > REPORT_DESCRIPTION_MAX) {
    return {
      ok: false,
      httpStatus: 400,
      code: "VALIDATION_ERROR",
      message: `Description must be at most ${REPORT_DESCRIPTION_MAX} characters.`,
    };
  }

  const githubOk = deps.githubConfigured();
  const operatorOk = deps.operatorConfigured();
  if (!githubOk && !operatorOk) {
    return {
      ok: false,
      httpStatus: 500,
      code: "CONFIG_ERROR",
      message: "Reporting is not configured.",
    };
  }

  const user = await deps.loadUser(input.userId);
  if (!user) {
    return {
      ok: false,
      httpStatus: 400,
      code: "VALIDATION_ERROR",
      message: "Account not found.",
    };
  }

  const league = await deps.resolveLeague(input.userId, input.currentPathname);

  let screenshotUrl: string | null = null;
  let screenshotOmitted = false;
  if (input.screenshot) {
    try {
      screenshotUrl = await deps.uploadScreenshot({
        userId: input.userId,
        bytes: input.screenshot.bytes,
        contentType: input.screenshot.contentType,
      });
    } catch {
      screenshotOmitted = true;
    }
  }

  const identity = {
    id: user.id,
    name: displayName(user),
    email: user.email,
  };
  const body = buildIssueMarkdown({
    description,
    screenshotUrl,
    user: identity,
    league,
    visitTrail: input.visitTrail,
    device: deviceFromInput(input),
  });
  const title = buildIssueTitle(description);

  let githubFallback = false;
  if (githubOk) {
    try {
      await deps.createIssue({ title, body });
    } catch (err) {
      githubFallback = true;
      const githubError = err instanceof Error ? err.message : String(err);
      try {
        await deps.sendOperatorFallback({ title, body, githubError });
      } catch {
        return {
          ok: false,
          httpStatus: 502,
          code: "DELIVERY_FAILED",
          message: "We couldn't send your report. Please try again.",
        };
      }
    }
  } else {
    githubFallback = true;
    try {
      await deps.sendOperatorFallback({
        title,
        body,
        githubError: "GitHub reports is not configured",
      });
    } catch {
      return {
        ok: false,
        httpStatus: 502,
        code: "DELIVERY_FAILED",
        message: "We couldn't send your report. Please try again.",
      };
    }
  }

  try {
    await deps.sendReceipt({ to: user.email, userId: user.id });
  } catch {
    // F3a: receipt failure must not fail the request.
  }

  return {
    ok: true,
    ...(screenshotOmitted ? { screenshotOmitted: true } : {}),
    ...(githubFallback ? { githubFallback: true } : {}),
  };
}
