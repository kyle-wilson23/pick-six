/**
 * POST `/api/reports` — authenticated user bug/feedback report (multipart).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
  AVATAR_MAX_BYTES,
  sniffAvatarMime,
  validateAvatarFile,
} from "@/lib/avatar";
import { assertCookieSessionMutationOrigin } from "@/lib/cookie-session-mutation-csrf";
import { prisma } from "@/lib/db";
import { sendReportFallbackEmail, sendReportReceiptEmail } from "@/lib/email/send-report-emails";
import { createGitHubIssue } from "@/lib/integrations/github/create-issue";
import { logEvent } from "@/lib/logging/log-event";
import {
  reportDescriptionSchema,
  reportDeviceFieldsSchema,
  reportPathnameSchema,
  reportVisitTrailSchema,
} from "@/lib/reports/report-form-schema";
import {
  isGitHubReportsConfigured,
  isOperatorEmailConfigured,
} from "@/lib/reports/reports-config";
import { resolveReportLeague } from "@/lib/reports/resolve-report-league";
import { submitUserReport } from "@/lib/reports/submit-user-report";
import { uploadReportScreenshot } from "@/lib/reports/upload-report-screenshot";
import { appendVisitPath } from "@/lib/reports/visit-trail";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function parseVisitTrailField(raw: FormDataEntryValue | null) {
  if (raw == null || raw === "") {
    return reportVisitTrailSchema.safeParse([]);
  }
  if (typeof raw !== "string") {
    return reportVisitTrailSchema.safeParse(undefined);
  }
  if (raw.length > 8192) {
    return reportVisitTrailSchema.safeParse(undefined);
  }
  try {
    return reportVisitTrailSchema.safeParse(JSON.parse(raw));
  } catch {
    return reportVisitTrailSchema.safeParse(undefined);
  }
}

export async function POST(request: NextRequest) {
  const csrfError = assertCookieSessionMutationOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  const contentLength = Number(request.headers.get("content-length") ?? NaN);
  if (Number.isFinite(contentLength) && contentLength > AVATAR_MAX_BYTES + 256 * 1024) {
    return jsonError("TOO_LARGE", "Image must be 5MB or smaller.", 400);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("VALIDATION_ERROR", "Invalid form data", 400);
  }

  const descriptionParsed = reportDescriptionSchema.safeParse(form.get("description") ?? "");
  if (!descriptionParsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      descriptionParsed.error.issues[0]?.message ?? "Please describe the problem.",
      400,
    );
  }

  const trailParsed = parseVisitTrailField(form.get("visitTrail"));
  if (!trailParsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid visit trail", 400);
  }

  const pathnameParsed = reportPathnameSchema.safeParse(form.get("pathname") ?? "/");
  if (!pathnameParsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid pathname", 400);
  }

  const deviceParsed = reportDeviceFieldsSchema.safeParse({
    userAgent: form.get("userAgent") ?? request.headers.get("user-agent") ?? "",
    viewportWidth: form.get("viewportWidth") ?? "0",
    viewportHeight: form.get("viewportHeight") ?? "0",
  });
  if (!deviceParsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid device fields", 400);
  }

  const file = form.get("screenshot");
  let screenshot: { bytes: Uint8Array; contentType: "image/jpeg" | "image/png" | "image/webp" } | null =
    null;
  if (file instanceof File && file.size > 0) {
    if (file.size > AVATAR_MAX_BYTES) {
      return jsonError("TOO_LARGE", "Image must be 5MB or smaller.", 400);
    }
    let buffer: Uint8Array;
    try {
      buffer = new Uint8Array(await file.arrayBuffer());
    } catch {
      return jsonError("VALIDATION_ERROR", "Invalid form data", 400);
    }
    if (buffer.byteLength > AVATAR_MAX_BYTES) {
      return jsonError("TOO_LARGE", "Image must be 5MB or smaller.", 400);
    }
    const sniffed = sniffAvatarMime(buffer);
    if (!sniffed) {
      return jsonError("BAD_TYPE", "Use a JPEG, PNG, or WebP image.", 400);
    }
    const meta = validateAvatarFile({ mime: sniffed, size: buffer.byteLength });
    if (!meta.ok) {
      return jsonError(meta.code, meta.message, 400);
    }
    screenshot = { bytes: buffer, contentType: sniffed };
  }

  let result;
  try {
    result = await submitUserReport(
    {
      userId: session.user.id,
      description: descriptionParsed.data,
      visitTrail: appendVisitPath(trailParsed.data, pathnameParsed.data),
      currentPathname: pathnameParsed.data,
      userAgent: deviceParsed.data.userAgent,
      viewportWidth: deviceParsed.data.viewportWidth,
      viewportHeight: deviceParsed.data.viewportHeight,
      screenshot,
    },
    {
      resolveLeague: resolveReportLeague,
      loadUser: async (userId) =>
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true },
        }),
      githubConfigured: isGitHubReportsConfigured,
      operatorConfigured: isOperatorEmailConfigured,
      uploadScreenshot: uploadReportScreenshot,
      createIssue: createGitHubIssue,
      sendOperatorFallback: sendReportFallbackEmail,
      sendReceipt: async (input) => {
        try {
          await sendReportReceiptEmail(input);
        } catch (err) {
          logEvent({
            level: "error",
            domain: "email",
            action: "report_receipt_failed",
            message: "user report receipt failed after delivery",
            userId: input.userId,
            context: { error: err instanceof Error ? err.message : String(err) },
          });
          throw err;
        }
      },
    },
    );
  } catch (err) {
    logEvent({
      level: "error",
      domain: "api",
      action: "report_submit_failed",
      message: "user report submit threw",
      userId: session.user.id,
      context: { error: err instanceof Error ? err.message : String(err) },
    });
    return jsonError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }

  if (!result.ok) {
    logEvent({
      level: "error",
      domain: "api",
      action: "report_submit_failed",
      message: result.message,
      userId: session.user.id,
      code: result.code,
    });
    return jsonError(result.code, result.message, result.httpStatus);
  }

  logEvent({
    level: "info",
    domain: "api",
    action: "report_submit_ok",
    message: "user report submitted",
    userId: session.user.id,
    context: {
      screenshotOmitted: result.screenshotOmitted === true,
      githubFallback: result.githubFallback === true,
    },
  });

  return NextResponse.json({
    ok: true,
    ...(result.screenshotOmitted ? { screenshotOmitted: true } : {}),
    ...(result.githubFallback ? { githubFallback: true } : {}),
  });
}
