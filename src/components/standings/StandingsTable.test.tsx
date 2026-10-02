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
    imageUrl: "https://example.com/alex.jpg",
    totalPoints: 12,
    wins: 6,
    losses: 2,
    ties: 0,
    rank: 1,
  },
  {
    membershipId: "m-peer",
    displayName: "Pat Player",
    imageUrl: null,
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

describe("StandingsTable variants", () => {
  it("keeps Pts on the points table and shows Valid losses on the biggest-loser table", () => {
    const { container, rerender } = render(
      <ThemeProvider theme={darkTheme}>
        <StandingsTable standings={fixtureStandings} currentMembershipId="m-you" />
      </ThemeProvider>,
    );

    const pointsTable = container.querySelector("table");
    expect(pointsTable?.getAttribute("aria-label")).toBe("League standings");
    expect(pointsTable?.querySelectorAll("th")[3]?.textContent).toBe("Pts");
    const pointsRows = pointsTable?.querySelectorAll("tbody tr") ?? [];
    expect(pointsRows[0]?.querySelectorAll("td")[3]?.textContent).toBe("12");
    expect(pointsRows[1]?.querySelectorAll("td")[3]?.textContent).toBe("10");

    rerender(
      <ThemeProvider theme={darkTheme}>
        <StandingsTable
          variant="biggest-loser"
          standings={fixtureStandings}
          currentMembershipId="m-you"
        />
      </ThemeProvider>,
    );

    const loserTable = container.querySelector("table");
    expect(loserTable?.getAttribute("aria-label")).toBe("Biggest loser");
    expect(loserTable?.querySelectorAll("th")[3]?.textContent).toBe("Valid losses");
    const loserRows = loserTable?.querySelectorAll("tbody tr") ?? [];
    expect(loserRows[0]?.querySelectorAll("td")[3]?.textContent).toBe("2");
    expect(loserRows[1]?.querySelectorAll("td")[3]?.textContent).toBe("3");

    const currentRow = container.querySelector('tr[aria-current="true"]');
    expect(currentRow).not.toBeNull();
    expect(currentRow?.textContent).toContain("(You)");
  });

  it("shows the unscored caption only on the points variant", () => {
    const unscored: StandingsEntry[] = [
      {
        ...fixtureStandings[0],
        totalPoints: 0,
        wins: 0,
        losses: 0,
        ties: 0,
      },
    ];

    const { container, rerender } = render(
      <ThemeProvider theme={darkTheme}>
        <StandingsTable standings={unscored} currentMembershipId="m-you" />
      </ThemeProvider>,
    );

    expect(container.textContent).toContain("No results scored yet");

    rerender(
      <ThemeProvider theme={darkTheme}>
        <StandingsTable variant="biggest-loser" standings={unscored} currentMembershipId="m-you" />
      </ThemeProvider>,
    );

    expect(container.textContent).not.toContain("No results scored yet");
    expect(container.querySelectorAll("tbody tr")[0]?.querySelectorAll("td")[3]?.textContent).toBe(
      "0",
    );
  });
});
