// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PicksWeekMatchupJson } from "@/lib/picks/picks-week-view-types";

import { MatchupCard } from "./MatchupCard";

afterEach(() => {
  cleanup();
});

const theme = createTheme({ palette: { mode: "dark" } });

const matchup: PicksWeekMatchupJson = {
  gameId: "pit-cle",
  kickoffAt: "2026-10-01T00:15:00.000Z",
  awayTeam: { id: "pit", abbreviation: "PIT", name: "Pittsburgh Steelers" },
  homeTeam: { id: "cle", abbreviation: "CLE", name: "Cleveland Browns" },
  awayMoneylineAmerican: 1.41,
  homeMoneylineAmerican: 2.78,
  homeSpreadPoints: 5.5,
  weather: null,
  stadiumRoof: null,
};

function renderCard() {
  return render(
    <ThemeProvider theme={theme}>
      <MatchupCard matchup={matchup} />
    </ThemeProvider>,
  );
}

describe("MatchupCard spread", () => {
  it("shows each side's spread once and does not repeat it in a footer", () => {
    renderCard();

    expect(screen.getByText("ML 1.41 · -5.5")).toBeTruthy();
    expect(screen.getByText("ML 2.78 · +5.5")).toBeTruthy();
    expect(screen.queryByText(/home perspective/)).toBeNull();
    expect(screen.queryByText(/Spread · Home/)).toBeNull();
    expect(screen.getByLabelText("Pittsburgh Steelers, moneyline 1.41, spread -5.5")).toBeTruthy();
    expect(screen.getByLabelText("Cleveland Browns, moneyline 2.78, spread +5.5")).toBeTruthy();
  });
});
