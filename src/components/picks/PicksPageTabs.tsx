"use client";

import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { useState, type ReactNode, type SyntheticEvent } from "react";

import { OpponentsPicksTable } from "@/components/picks/OpponentsPicksTable";
import type { LeagueWeekPeerPickRow } from "@/lib/picks/get-league-week-peer-picks";

type PicksPageTabsProps = {
  /** Server-gated rows; `null` means deadline not passed — hide tabs entirely. */
  opponentsRows: LeagueWeekPeerPickRow[] | null;
  myPickContent: ReactNode;
};

type TabValue = "my-pick" | "opponents";

export function PicksPageTabs({ opponentsRows, myPickContent }: PicksPageTabsProps) {
  const [tab, setTab] = useState<TabValue>("my-pick");

  if (opponentsRows == null) {
    return <>{myPickContent}</>;
  }

  const handleChange = (_event: SyntheticEvent, value: string) => {
    setTab(value as TabValue);
  };

  return (
    <Stack spacing={3}>
      <Tabs
        value={tab}
        onChange={handleChange}
        aria-label="Picks views"
        variant="fullWidth"
      >
        <Tab
          label="My Pick"
          value="my-pick"
          id="picks-tab-my-pick"
          aria-controls="picks-panel-my-pick"
        />
        <Tab
          label="Opponents' Picks"
          value="opponents"
          id="picks-tab-opponents"
          aria-controls="picks-panel-opponents"
        />
      </Tabs>

      {tab === "my-pick" ? (
        <Stack
          role="tabpanel"
          id="picks-panel-my-pick"
          aria-labelledby="picks-tab-my-pick"
        >
          {myPickContent}
        </Stack>
      ) : (
        <Stack
          role="tabpanel"
          id="picks-panel-opponents"
          aria-labelledby="picks-tab-opponents"
        >
          <OpponentsPicksTable rows={opponentsRows} />
        </Stack>
      )}
    </Stack>
  );
}
