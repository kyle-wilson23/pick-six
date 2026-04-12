import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { InviteParticipantsForm } from "./invite-participants-form";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function LeagueInvitesPage({ params }: PageProps) {
  const { leagueId } = await params;

  return (
    <Stack
      component="main"
      spacing={3}
      sx={{
        minHeight: "100vh",
        px: 2,
        py: 4,
        maxWidth: 560,
        mx: "auto",
      }}
    >
      <Typography variant="h4" component="h1">
        Invite participants
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Paste or type email addresses (comma, semicolon, or newline separated). Each person receives a
        signup link. In development, links are printed in the server console.
      </Typography>
      <InviteParticipantsForm leagueId={leagueId} />
    </Stack>
  );
}
