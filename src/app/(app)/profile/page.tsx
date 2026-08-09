import Stack from "@mui/material/Stack";
import { redirect } from "next/navigation";

import { ProfileClient } from "@/app/(app)/profile/profile-client";
import { auth } from "@/lib/auth";
import { buildLoginRedirectWithCallback } from "@/lib/callback-url";
import { colorModeFromPrisma } from "@/lib/color-mode";
import { prisma } from "@/lib/db";
import { userDisplayName } from "@/lib/user-display-name";
import { appContentWidthSx } from "@/theme/app-content-width";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildLoginRedirectWithCallback("/profile"));
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      image: true,
      colorMode: true,
    },
  });

  if (!user) {
    redirect(buildLoginRedirectWithCallback("/profile"));
  }

  const displayName = userDisplayName({ name: user.name, email: user.email });

  return (
    <Stack
      component="main"
      id="main-content"
      tabIndex={-1}
      spacing={3}
      sx={{
        ...skipTargetMainSx,
        ...appContentWidthSx,
        px: 2,
        py: 4,
      }}
    >
      <ProfileClient
        email={user.email}
        firstName={user.firstName ?? ""}
        lastName={user.lastName ?? ""}
        displayName={displayName}
        imageUrl={user.image}
        colorMode={colorModeFromPrisma(user.colorMode)}
      />
    </Stack>
  );
}
