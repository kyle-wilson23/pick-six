import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

import { skipTargetMainSx } from "@/theme/focus-visible-ring";

function MatchupCardSkeleton() {
  return (
    <Stack
      spacing={1.5}
      sx={{
        width: "100%",
        maxWidth: { xs: 560, md: "none" },
        px: { xs: 1.25, sm: 2 },
        py: { xs: 1.25, sm: 1.5 },
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Skeleton variant="text" width={120} height={20} />
        <Skeleton variant="rounded" width={160} height={24} />
      </Stack>
      <Skeleton variant="rectangular" height={1} sx={{ bgcolor: "divider" }} />
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        justifyContent="space-between"
      >
        <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="text" width="60%" height={28} />
          </Stack>
          <Skeleton variant="text" width="40%" height={20} sx={{ ml: 5 }} />
        </Stack>
        <Skeleton variant="text" width={24} height={24} sx={{ alignSelf: "center" }} />
        <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="text" width="60%" height={28} />
          </Stack>
          <Skeleton variant="text" width="40%" height={20} sx={{ ml: 5 }} />
        </Stack>
      </Stack>
      <Skeleton variant="text" width="70%" height={18} />
    </Stack>
  );
}

export default function PicksLoading() {
  return (
    <Stack
      component="main"
      id="main-content"
      tabIndex={-1}
      spacing={3}
      sx={{
        minHeight: "100vh",
        px: { xs: 1.5, sm: 2 },
        py: { xs: 3, md: 4 },
        maxWidth: { xs: 640, md: 960 },
        mx: "auto",
        alignItems: "stretch",
        ...skipTargetMainSx,
      }}
      aria-busy="true"
      aria-label="Loading weekly picks"
    >
      <Skeleton variant="text" width={220} height={40} />
      <Stack
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <MatchupCardSkeleton />
        <MatchupCardSkeleton />
        <MatchupCardSkeleton />
        <MatchupCardSkeleton />
      </Stack>
    </Stack>
  );
}
