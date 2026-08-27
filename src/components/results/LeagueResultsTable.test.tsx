// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LeagueResultsTable } from "./LeagueResultsTable";

afterEach(() => {
  cleanup();
});

const theme = createTheme({ palette: { mode: "dark" } });

describe("LeagueResultsTable", () => {
  it("shows a submitted check when team identity is missing", () => {
    render(
      <ThemeProvider theme={theme}>
        <LeagueResultsTable
          currentMembershipId="mem-admin"
          history={{
            weeks: [
              {
                weekNumber: 5,
                isRevealed: false,
                entries: [
                  {
                    membershipId: "mem-peer",
                    displayName: "Peer",
                    imageUrl: null,
                    teamAbbreviation: null,
                    teamName: null,
                    antiJailedBonus: false,
                    outcome: "PENDING",
                    pointsEarned: null,
                  },
                ],
              },
            ],
          }}
        />
      </ThemeProvider>,
    );

    expect(screen.getByLabelText("Pick submitted")).toBeTruthy();
    expect(screen.getByText("Submitted")).toBeTruthy();
  });
});
