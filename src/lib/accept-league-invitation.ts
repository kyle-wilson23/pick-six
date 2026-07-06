import { LeagueMembershipRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { isInvitationUsable } from "@/lib/invitations";
import { normalizeEmail } from "@/lib/normalize-email";

export type AcceptLeagueInvitationResult = {
  leagueId: string | null;
  leagueName: string | null;
};

export class InviteAcceptError extends Error {
  readonly code: "INVITE_BAD" | "EMAIL_MISMATCH";

  constructor(code: "INVITE_BAD" | "EMAIL_MISMATCH") {
    super(code);
    this.code = code;
  }
}

/** Consume a pending invitation for an existing user (same email as invite). */
export async function acceptLeagueInvitation({
  tokenHash,
  userId,
  userEmail,
  now = new Date(),
}: {
  tokenHash: string;
  userId: string;
  userEmail: string;
  now?: Date;
}): Promise<AcceptLeagueInvitationResult> {
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { tokenHash },
      include: { league: { select: { name: true } } },
    });
    if (!invitation || !isInvitationUsable(invitation, now)) {
      throw new InviteAcceptError("INVITE_BAD");
    }

    const invitedEmail = normalizeEmail(invitation.invitedEmail);
    if (invitedEmail !== normalizeEmail(userEmail)) {
      throw new InviteAcceptError("EMAIL_MISMATCH");
    }

    if (invitation.leagueId) {
      await tx.leagueMembership.upsert({
        where: {
          userId_leagueId: { userId, leagueId: invitation.leagueId },
        },
        create: {
          userId,
          leagueId: invitation.leagueId,
          role: LeagueMembershipRole.MEMBER,
        },
        update: {},
      });
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { consumedAt: now },
    });

    return {
      leagueId: invitation.leagueId,
      leagueName: invitation.league?.name ?? null,
    };
  });
}
