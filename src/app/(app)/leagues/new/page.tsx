import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { allowTestLeagues } from "@/lib/league/allow-test-leagues";

import { appContentWidthSx } from "@/theme/app-content-width";
import { skipTargetMainSx } from "@/theme/focus-visible-ring";

import { CreateLeagueForm } from "./create-league-form";

export default function NewLeaguePage() {
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
      <Typography variant="h4" component="h1">
        Create a league
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Name your league and choose the first NFL week when picks count. Week 1 is selected by
        default; pick a later week if your league starts mid-season.
      </Typography>
      <CreateLeagueForm allowTestLeagues={allowTestLeagues()} />
    </Stack>
  );
}
