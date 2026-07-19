// @vitest-environment jsdom
/**
 * WCAG 2.1 Level A smoke (axe tags: wcag2a) for StandingsTable.
 * jsdom-only — do not convert the default Vitest suite off node.
 */
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import type { StandingsEntry } from "@/lib/scoring/get-league-standings";

import { StandingsTable } from "./StandingsTable";

afterEach(() => {
  cleanup();
});

beforeAll(() => {
  // axe color-contrast may touch canvas in some environments
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
});

const fixtureStandings: StandingsEntry[] = [
  {
    membershipId: "m-you",
    displayName: "Alex Admin",
    totalPoints: 12,
    wins: 6,
    losses: 2,
    ties: 0,
    rank: 1,
  },
  {
    membershipId: "m-peer",
    displayName: "Pat Player",
    totalPoints: 10,
    wins: 5,
    losses: 3,
    ties: 0,
    rank: 2,
  },
];

const darkTheme = createTheme({ palette: { mode: "dark" } });

describe("StandingsTable a11y", () => {
  it("has no wcag2a violations with fixture standings", async () => {
    const { container } = render(
      <ThemeProvider theme={darkTheme}>
        <StandingsTable standings={fixtureStandings} currentMembershipId="m-you" />
      </ThemeProvider>,
    );

    const results = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a"] },
    });

    expect(results.violations).toEqual([]);
  });

  it("exposes accessible name and current-user row semantics", () => {
    const { container } = render(
      <ThemeProvider theme={darkTheme}>
        <StandingsTable standings={fixtureStandings} currentMembershipId="m-you" />
      </ThemeProvider>,
    );

    const table = container.querySelector("table");
    expect(table?.getAttribute("aria-label")).toBe("League standings");

    const currentRow = container.querySelector('tr[aria-current="true"]');
    expect(currentRow).not.toBeNull();
    expect(currentRow?.textContent).toContain("(You)");
  });
});
