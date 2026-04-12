import { getAppBaseUrl } from "@/lib/email/app-base-url";

export type SendInvitationEmailInput = {
  to: string;
  rawToken: string;
  leagueName: string;
};

/**
 * MVP: log only (Epic 6 will add a real provider). Never called from the client.
 */
export function sendInvitationEmail(input: SendInvitationEmailInput): void {
  const url = `${getAppBaseUrl()}/signup/${input.rawToken}`;
  console.info(
    `[sendInvitationEmail] to=${input.to} league=${input.leagueName} signupUrl=${url}`,
  );
}
