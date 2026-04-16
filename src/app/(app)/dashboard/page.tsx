import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { auth } from "@/lib/auth";
import { AdminLeaguesLinkButton } from "@/components/leagues/admin-leagues-link-button";
import { CreateLeagueLinkButton } from "@/components/leagues/create-league-link-button";
import { MyLeaguesLinkButton } from "@/components/leagues/my-leagues-link-button";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <Stack
      component="main"
      spacing={2}
      sx={{
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
      }}
    >
      <Typography variant="h4" component="h1">
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Signed in as {session?.user?.email ?? session?.user?.name ?? session?.user?.id}
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 480 }}>
        Authenticated area for future league features. Public routes (home, login, signup) stay
        outside the <code>(app)</code> group.
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap justifyContent="center">
        <MyLeaguesLinkButton />
        <AdminLeaguesLinkButton />
        <CreateLeagueLinkButton />
      </Stack>
    </Stack>
  );
}
