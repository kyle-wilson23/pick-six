import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { CreateLeagueForm } from "./create-league-form";

export default function NewLeaguePage() {
  return (
    <Stack
      component="main"
      spacing={3}
      sx={{
        minHeight: "100vh",
        px: 2,
        py: 4,
        maxWidth: 480,
        mx: "auto",
      }}
    >
      <Typography variant="h4" component="h1">
        Create a league
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Name your league and choose the first NFL week when picks count. Week 1 is selected by
        default; pick a later week if your league starts mid-season.
      </Typography>
      <CreateLeagueForm />
    </Stack>
  );
}
