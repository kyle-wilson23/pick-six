import "server-only";

import { createElement } from "react";

import { getResendFrom } from "@/lib/email/resend-from";
import { resend } from "@/lib/email/resend-client";
import { sendWithRetry } from "@/lib/email/send-with-retry";
import { ReportFallbackEmail } from "@/lib/email/templates/ReportFallbackEmail";
import { ReportReceiptEmail } from "@/lib/email/templates/ReportReceiptEmail";
import { logEvent } from "@/lib/logging/log-event";
import { getReportsOperatorEmail } from "@/lib/reports/reports-config";

export type SendReportReceiptInput = {
  to: string;
  userId: string;
};

export async function sendReportReceiptEmail(input: SendReportReceiptInput): Promise<void> {
  const idempotencyKey = `report-receipt:${input.userId}:${crypto.randomUUID()}`;
  await sendWithRetry(async () => {
    const { data, error } = await resend.emails.send(
      {
        from: getResendFrom(),
        to: [input.to],
        subject: "We received your Pigskin Pick'Em report",
        react: createElement(ReportReceiptEmail),
      },
      { idempotencyKey },
    );
    if (error) {
      throw error;
    }
    return data;
  });

  logEvent({
    level: "info",
    domain: "email",
    action: "report_receipt_sent",
    message: "user report receipt sent",
    userId: input.userId,
  });
}

export type SendReportFallbackInput = {
  title: string;
  body: string;
  githubError: string;
};

export async function sendReportFallbackEmail(input: SendReportFallbackInput): Promise<void> {
  const to = getReportsOperatorEmail();
  if (!to) {
    throw new Error("REPORTS_OPERATOR_EMAIL is not configured");
  }

  const idempotencyKey = `report-fallback:${crypto.randomUUID()}`;
  await sendWithRetry(async () => {
    const { data, error } = await resend.emails.send(
      {
        from: getResendFrom(),
        to: [to],
        subject: "[GitHub is down] User report — issue was not opened",
        react: createElement(ReportFallbackEmail, input),
      },
      { idempotencyKey },
    );
    if (error) {
      throw error;
    }
    return data;
  });

  logEvent({
    level: "warn",
    domain: "email",
    action: "report_github_fallback_sent",
    message: "user report delivered via operator fallback because GitHub failed",
    context: { githubError: input.githubError },
  });
}
