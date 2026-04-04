import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

import { GoldAccentChip } from "@/components/gold-accent-chip";
import Typography from "@mui/material/Typography";

export default function Home() {
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
      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        flexWrap="wrap"
        justifyContent="center"
      >
        <Button variant="contained" color="primary" size="large">
          Primary action
        </Button>
        <GoldAccentChip label="Anti-jailed bonus (2 pts)" />
      </Stack>
    </Stack>
  );
}
