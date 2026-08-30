// @vitest-environment jsdom
import { ThemeProvider } from "@mui/material";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { LeaguePeerPickHistory, PeerPickEntry } from "@/lib/scoring/get-league-peer-pick-history";
import { createAppTheme } from "@/theme/create-app-theme";

import { LeagueResultsTable } from "./LeagueResultsTable";

afterEach(() => {
  cleanup();
});

const theme = createAppTheme("Inter", "dark");

function entry(overrides: Partial<PeerPickEntry> = {}): PeerPickEntry {
  return {
    membershipId: "mem-peer",
    displayName: "Peer",
    imageUrl: null,
    teamAbbreviation: "KC",
    teamName: "Kansas City Chiefs",
    antiJailedBonus: false,
    outcome: "WIN",
    pointsEarned: 1,
    ...overrides,
  };
}

function history(weeks: LeaguePeerPickHistory["weeks"]): LeaguePeerPickHistory {
  return { weeks };
}

function renderTable(historyProp: LeaguePeerPickHistory, currentMembershipId = "mem-you") {
  return render(
    <ThemeProvider theme={theme}>
      <LeagueResultsTable history={historyProp} currentMembershipId={currentMembershipId} />
    </ThemeProvider>,
  );
}

describe("LeagueResultsTable", () => {
  it("shows a submitted check when team identity is missing", () => {
    renderTable(
      history([
        {
          weekNumber: 5,
          isRevealed: false,
          entries: [
            entry({
              teamAbbreviation: null,
              teamName: null,
              antiJailedBonus: false,
              outcome: "PENDING",
              pointsEarned: null,
            }),
            entry({
              membershipId: "mem-partial",
              displayName: "Partial",
              teamAbbreviation: "KC",
              teamName: "",
              outcome: "PENDING",
              pointsEarned: null,
            }),
          ],
        },
      ]),
      "mem-admin",
    );

    expect(screen.getAllByLabelText("Pick submitted")).toHaveLength(2);
    expect(screen.getAllByText("Submitted")).toHaveLength(2);
    expect(screen.getByRole("table", { name: "League results week 5" })).toBeTruthy();
    expect(screen.queryByTitle("KC")).toBeNull();
    expect(screen.queryByTitle("Kansas City Chiefs")).toBeNull();
  });

  it("exposes a labeled table per week and a title for long names", () => {
    const longName = "Alexandria Montgomery-Williams the Third";
    renderTable(
      history([
        {
          weekNumber: 5,
          isRevealed: true,
          entries: [entry({ membershipId: "mem-you", displayName: longName })],
        },
      ]),
    );

    expect(screen.getByRole("table", { name: "League results week 5" })).toBeTruthy();
    expect(screen.getAllByTitle(longName).length).toBeGreaterThan(0);
    expect(screen.getByText(longName)).toBeTruthy();
  });

  it("keeps the anti-jailed chip when the team is revealed", () => {
    renderTable(
      history([
        {
          weekNumber: 1,
          isRevealed: true,
          entries: [
            entry({
              antiJailedBonus: true,
              outcome: "WIN",
              pointsEarned: 2,
            }),
          ],
        },
      ]),
    );

    expect(screen.getByText("KC")).toBeTruthy();
    expect(screen.getByText("2 PTS")).toBeTruthy();
    expect(screen.getByTitle("KC Kansas City Chiefs")).toBeTruthy();
  });

  it("shows empty-state copy and no table when there are no weeks", () => {
    const { container } = renderTable(history([]));

    expect(
      screen.getByText("League results will appear here after the first week is complete"),
    ).toBeTruthy();
    expect(container.querySelector("table")).toBeNull();
  });
});
