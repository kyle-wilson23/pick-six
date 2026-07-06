import { prisma } from "@/lib/db";

import {
  hashInviteToken,
  isInvitationUsable,
  type SignupInvitePreview,
} from "@/lib/invitations";
import { normalizeEmail } from "@/lib/normalize-email";

/** Server-only: resolve invite for signup page (validity for display + form). */
export async function getSignupInvitePreview(rawToken: string): Promise<SignupInvitePreview> {
  const tokenHash = hashInviteToken(rawToken);
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    include: { league: { select: { name: true } } },
  });
  const now = new Date();
  if (!invitation) {
    return { status: "invalid" };
  }
  if (!isInvitationUsable(invitation, now)) {
    return { status: "invalid" };
  }

  const league =
    invitation.leagueId && invitation.league ? { name: invitation.league.name } : null;

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizeEmail(invitation.invitedEmail) },
    select: { id: true },
  });

  if (existingUser) {
    return {
      status: "already_registered",
      invitedEmail: invitation.invitedEmail,
      league,
    };
  }

  return {
    status: "valid",
    invitedEmail: invitation.invitedEmail,
    league,
  };
}
