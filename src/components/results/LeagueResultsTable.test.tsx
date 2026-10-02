// @vitest-environment jsdom
import { ThemeProvider } from "@mui/material";
import { cleanup, render, screen, within } from "@testing-library/react";
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
    hasPick: true,
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
              hasPick: true,
              teamAbbreviation: null,
              teamName: null,
              antiJailedBonus: false,
              outcome: "PENDING",
              pointsEarned: null,
            }),
            entry({
              membershipId: "mem-partial",
              displayName: "Partial",
              hasPick: true,
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
    expect(screen.queryByText("No pick")).toBeNull();
  });

  it("shows No pick without a submitted check when the player did not pick", () => {
    renderTable(
      history([
        {
          weekNumber: 5,
          isRevealed: true,
          entries: [
            entry({
              membershipId: "mem-miss",
              displayName: "Miss",
              hasPick: false,
              teamAbbreviation: null,
              teamName: null,
              antiJailedBonus: false,
              outcome: "PENDING",
              pointsEarned: 0,
            }),
          ],
        },
      ]),
    );

    const row = screen.getByText("Miss").closest("tr");
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain("No pick");
    expect(row?.textContent).not.toContain("Submitted");
    expect(row?.textContent).not.toContain("Pick submitted");
    expect(screen.getByText("No pick")).toBeTruthy();
    expect(screen.queryByText("Submitted")).toBeNull();
    expect(screen.queryByLabelText("Pick submitted")).toBeNull();
    expect(screen.queryByTitle("KC")).toBeNull();
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

  it("shows Jack's season record 2-1 on a revealed miss without a LOSS chip", () => {
    renderTable(
      history([
        {
          weekNumber: 1,
          isRevealed: true,
          entries: [
            entry({
              membershipId: "mem-jack",
              displayName: "Jack Quirke",
              outcome: "WIN",
              pointsEarned: 1,
            }),
          ],
        },
        {
          weekNumber: 2,
          isRevealed: true,
          entries: [
            entry({
              membershipId: "mem-jack",
              displayName: "Jack Quirke",
              hasPick: false,
              teamAbbreviation: null,
              teamName: null,
              antiJailedBonus: false,
              outcome: "LOSS",
              pointsEarned: 0,
            }),
          ],
        },
        {
          weekNumber: 3,
          isRevealed: true,
          entries: [
            entry({
              membershipId: "mem-jack",
              displayName: "Jack Quirke",
              outcome: "WIN",
              pointsEarned: 1,
            }),
          ],
        },
        {
          weekNumber: 4,
          isRevealed: false,
          entries: [
            entry({
              membershipId: "mem-jack",
              displayName: "Jack Quirke",
              hasPick: false,
              teamAbbreviation: null,
              teamName: null,
              antiJailedBonus: false,
              outcome: "PENDING",
              pointsEarned: null,
            }),
          ],
        },
      ]),
    );

    const week2 = screen.getByRole("table", { name: "League results week 2" });
    const missRow = within(week2).getByText("No pick").closest("tr");
    expect(missRow?.textContent).toContain("2-1");
    expect(missRow?.textContent).toContain("No pick");
    expect(missRow?.textContent).toContain("—");
    expect(missRow?.textContent).toContain("0");
    expect(missRow?.textContent).not.toContain("LOSS");
    expect(within(week2).getByRole("columnheader", { name: "Participant" })).toBeTruthy();
    expect(within(week2).getByRole("columnheader", { name: "Team" })).toBeTruthy();
    expect(within(week2).getByRole("columnheader", { name: "Result" })).toBeTruthy();
    expect(within(week2).getByRole("columnheader", { name: "Record" })).toBeTruthy();
    expect(within(week2).getByRole("columnheader", { name: "Pts" })).toBeTruthy();
    expect(screen.queryByText("LOSS")).toBeNull();

    const week4 = screen.getByRole("table", { name: "League results week 4" });
    expect(week4.querySelector("tbody tr")?.textContent).toContain("2-1");
  });

  it("shows empty-state copy and no table when there are no weeks", () => {
    const { container } = renderTable(history([]));

    expect(
      screen.getByText("League results will appear here after the first week is complete"),
    ).toBeTruthy();
    expect(container.querySelector("table")).toBeNull();
  });
});
