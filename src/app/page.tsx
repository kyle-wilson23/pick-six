import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { DashboardLinkButton } from "@/components/auth/dashboard-link-button";
import { LoginLinkButton } from "@/components/auth/login-link-button";
import { LogoutButton } from "@/components/auth/logout-button";
import { GoldAccentChip } from "@/components/gold-accent-chip";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <Stack
      component="main"
      spacing={3}
      sx={{
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
      }}
    >
      <Typography variant="h3" component="h1">
        Pick Six
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        align="center"
        sx={{ maxWidth: 480 }}
      >
        Next.js App Router + MUI dark shell — Inter typography, emerald primary,
        gold accent for special highlights.
      </Typography>
      {session?.user ? (
        <Typography variant="body2" color="text.secondary">
          Signed in as {session.user.email ?? session.user.name ?? session.user.id}
        </Typography>
      ) : null}
      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        flexWrap="wrap"
        justifyContent="center"
        alignItems="center"
      >
        {session?.user ? (
          <>
            <DashboardLinkButton />
            <LogoutButton />
          </>
        ) : (
          <LoginLinkButton />
        )}
        <Button variant="contained" color="primary" size="large">
          Primary action
        </Button>
        <GoldAccentChip label="Anti-jailed bonus (2 pts)" />
      </Stack>
    </Stack>
  );
}
