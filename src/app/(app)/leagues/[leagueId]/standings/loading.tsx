import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import { skipTargetMainSx } from "@/theme/focus-visible-ring";

function StandingsRowSkeleton() {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Skeleton variant="text" width={28} height={24} />
      <Skeleton variant="text" width="45%" height={24} sx={{ flexGrow: 1 }} />
      <Skeleton variant="text" width={56} height={24} />
      <Skeleton variant="text" width={36} height={24} />
    </Stack>
  );
}

export default function StandingsLoading() {
  return (
    <Stack
      component="main"
      id="main-content"
      tabIndex={-1}
      spacing={3}
      sx={{
        minHeight: "100vh",
        px: 2,
        py: 4,
        maxWidth: 560,
        mx: "auto",
        ...skipTargetMainSx,
      }}
      aria-busy="true"
      aria-label="Loading standings"
    >
      <Skeleton variant="text" width={160} height={40} />
      <Stack spacing={0}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Skeleton variant="text" width={28} height={20} />
          <Skeleton variant="text" width="40%" height={20} sx={{ flexGrow: 1 }} />
          <Skeleton variant="text" width={56} height={20} />
          <Skeleton variant="text" width={36} height={20} />
        </Stack>
        <StandingsRowSkeleton />
        <StandingsRowSkeleton />
        <StandingsRowSkeleton />
        <StandingsRowSkeleton />
        <StandingsRowSkeleton />
        <StandingsRowSkeleton />
      </Stack>
    </Stack>
  );
}
