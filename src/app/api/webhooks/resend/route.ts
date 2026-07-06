/**
 * POST `/api/webhooks/resend` — Resend delivery webhook (Story 7.2, NFR32 log-only).
 *
 * Verifies Svix signature; logs delivery/bounce events. No cookie session or CSRF.
 */

import "server-only";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Webhook } from "svix";

import { logEvent } from "@/lib/logging/log-event";

const ROUTE = "/api/webhooks/resend";

function webhookActionFromEventType(eventType: string): string {
  switch (eventType) {
    case "email.delivered":
      return "email_delivered";
    case "email.bounced":
      return "email_bounced";
    case "email.complained":
      return "email_complained";
    default:
      return "email_event";
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: { code: "CONFIG_ERROR", message: "Webhook secret not configured" } },
      { status: 500 },
    );
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid webhook signature" } },
      { status: 401 },
    );
  }

  const rawBody = await request.text();

  try {
    const wh = new Webhook(secret);
    const payload = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type?: string; data?: Record<string, unknown> };

    const eventType = typeof payload.type === "string" ? payload.type : "unknown";
    const data = payload.data ?? {};

    logEvent({
      level: eventType === "email.bounced" || eventType === "email.complained" ? "warn" : "info",
      domain: "webhook",
      route: ROUTE,
      action: webhookActionFromEventType(eventType),
      message: `resend webhook: ${eventType}`,
      context: {
        emailId: data.email_id ?? data.id,
        eventType,
        to: data.to,
      },
    });

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid webhook signature" } },
      { status: 401 },
    );
  }
}
