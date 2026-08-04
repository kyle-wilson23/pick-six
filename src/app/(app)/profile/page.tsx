import Stack from "@mui/material/Stack";
import { redirect } from "next/navigation";

import { ProfileClient } from "@/app/(app)/profile/profile-client";
import { auth } from "@/lib/auth";
import { buildLoginRedirectWithCallback } from "@/lib/callback-url";
import { prisma } from "@/lib/db";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildLoginRedirectWithCallback("/profile"));
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, firstName: true, lastName: true },
  });

  if (!user) {
    redirect(buildLoginRedirectWithCallback("/profile"));
  }

  return (
    <Stack sx={{ py: 2, px: { xs: 2, sm: 3 }, width: "100%", alignItems: "flex-start" }}>
      <ProfileClient
        email={user.email}
        firstName={user.firstName ?? ""}
        lastName={user.lastName ?? ""}
      />
    </Stack>
  );
}
