// @vitest-environment jsdom
import { ThemeProvider } from "@mui/material";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type {
  PersonalPickHistory,
  PickHistoryEntry,
} from "@/lib/scoring/get-personal-pick-history";
import { createAppTheme } from "@/theme/create-app-theme";

import { PickHistoryTable } from "./PickHistoryTable";

afterEach(() => {
  cleanup();
});

const theme = createAppTheme("Inter", "dark");

type StyleHit = { media: string; text: string };

function classInCss(cssText: string, cls: string): boolean {
  return new RegExp(`\\.${cls}(?![\\w-])`).test(cssText);
}

function nestedRules(rule: CSSRule): CSSRuleList | null {
  if (!("cssRules" in rule)) return null;
  const group = rule as CSSRule & { cssRules?: CSSRuleList };
  return group.cssRules ?? null;
}

/** Emotion/MUI rules that apply to this element, including breakpoint media. */
function styleHitsFor(element: Element): StyleHit[] {
  const classes = Array.from(element.classList);
  const hits: StyleHit[] = [];

  const visit = (rule: CSSRule, media: string) => {
    if (rule instanceof CSSMediaRule) {
      const next = `${media} ${rule.conditionText}`.trim();
      for (const inner of Array.from(rule.cssRules)) visit(inner, next);
      return;
    }
    if (rule instanceof CSSStyleRule) {
      if (classes.some((cls) => classInCss(rule.cssText, cls))) {
        hits.push({ media, text: rule.cssText });
      }
      return;
    }
    const children = nestedRules(rule);
    if (children) {
      for (const inner of Array.from(children)) visit(inner, media);
    }
  };

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) visit(rule, "");
  }

  return hits;
}

/** MUI emits the `xs` value under `@media (min-width: 0px)`, then overrides at `md`. */
const belowMd = /min-width:\s*0px/i;
const mdUp = /min-width:\s*768px/i;

function hasRule(hits: StyleHit[], declaration: RegExp, media?: RegExp): boolean {
  return hits.some((hit) => {
    if (!declaration.test(hit.text)) return false;
    if (!media) return !mdUp.test(hit.media);
    return media.test(hit.media);
  });
}

function entry(overrides: Partial<PickHistoryEntry> = {}): PickHistoryEntry {
  return {
    nflWeekNumber: 1,
    teamAbbreviation: "KC",
    teamName: "Kansas City Chiefs",
    antiJailedBonus: false,
    outcome: "WIN",
    pointsEarned: 1,
    ...overrides,
  };
}

function history(overrides: Partial<PersonalPickHistory> = {}): PersonalPickHistory {
  return {
    entries: [entry()],
    totalPoints: 1,
    wins: 1,
    losses: 0,
    ties: 0,
    ...overrides,
  };
}

function renderTable(historyProp: PersonalPickHistory) {
  return render(
    <ThemeProvider theme={theme}>
      <PickHistoryTable history={historyProp} />
    </ThemeProvider>,
  );
}

describe("PickHistoryTable", () => {
  it("labels the table and keeps the full team name available while hiding it below md", () => {
    renderTable(history());

    const table = screen.getByRole("table", { name: "My pick history" });
    expect(screen.getByRole("columnheader", { name: "Wk" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Team" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Result" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Pts" })).toBeTruthy();
    expect(screen.getByText("KC")).toBeTruthy();
    expect(screen.getByText("WIN")).toBeTruthy();
    expect(screen.getByText("1-0 · 1 pts")).toBeTruthy();

    const tableHits = styleHitsFor(table);
    expect(hasRule(tableHits, /table-layout:\s*fixed/i)).toBe(true);
    expect(hasRule(tableHits, /width:\s*100%/i)).toBe(true);

    const container = table.parentElement;
    expect(container).toBeTruthy();
    const containerHits = styleHitsFor(container!);
    expect(hasRule(containerHits, /width:\s*100%/i)).toBe(true);
    expect(hasRule(containerHits, /overflow-x:\s*hidden/i)).toBe(true);

    const resultHeader = screen.getByRole("columnheader", { name: "Result" });
    const ptsHeader = screen.getByRole("columnheader", { name: "Pts" });
    expect(hasRule(styleHitsFor(resultHeader), /width:\s*80px/i)).toBe(true);
    expect(hasRule(styleHitsFor(resultHeader), /min-width:\s*72px/i)).toBe(true);
    expect(hasRule(styleHitsFor(ptsHeader), /width:\s*40px/i)).toBe(true);
    expect(hasRule(styleHitsFor(ptsHeader), /min-width:\s*36px/i)).toBe(true);

    const cell = screen.getByTitle("KC Kansas City Chiefs");
    const nameNode = Array.from(cell.querySelectorAll("p")).find(
      (node) => node.textContent === "Kansas City Chiefs",
    );
    if (!(nameNode instanceof HTMLParagraphElement)) {
      throw new Error("expected the full team name to stay in the document");
    }
    expect(cell.contains(nameNode)).toBe(true);
    expect(cell.textContent).toContain("KC");

    const nameHits = styleHitsFor(nameNode);
    expect(hasRule(nameHits, /display:\s*none/i, belowMd)).toBe(true);
    expect(hasRule(nameHits, /display:\s*block/i, mdUp)).toBe(true);

    const textBlock = nameNode.parentElement;
    expect(textBlock).toBeTruthy();
    const textHits = styleHitsFor(textBlock!);
    expect(hasRule(textHits, /align-items:\s*center/i, belowMd)).toBe(true);
    expect(hasRule(textHits, /align-items:\s*flex-start/i, mdUp)).toBe(true);

    const cellHits = styleHitsFor(cell);
    expect(hasRule(cellHits, /vertical-align:\s*middle/i, belowMd)).toBe(true);
    expect(hasRule(cellHits, /vertical-align:\s*inherit/i, mdUp)).toBe(true);
  });

  it("keeps the anti-jailed chip beside the abbreviation", () => {
    renderTable(
      history({
        entries: [entry({ antiJailedBonus: true, pointsEarned: 2 })],
        totalPoints: 2,
      }),
    );

    const abbreviation = screen.getByText("KC");
    expect(abbreviation.parentElement?.textContent).toContain("2 PTS");
    expect(screen.getByText("2 PTS")).toBeTruthy();
    expect(screen.getByTitle("KC Kansas City Chiefs")).toBeTruthy();
  });

  it("shows em dashes when the pick is still pending", () => {
    renderTable(
      history({
        entries: [
          entry({
            nflWeekNumber: 4,
            outcome: "PENDING",
            pointsEarned: null,
          }),
        ],
        totalPoints: 0,
        wins: 0,
      }),
    );

    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.queryByText("WIN")).toBeNull();
    expect(screen.queryByText("LOSS")).toBeNull();
    expect(screen.queryByText("TIE")).toBeNull();
    expect(screen.getByText("KC")).toBeTruthy();
  });

  it("shows empty-state copy and no table when there are no entries", () => {
    const { container } = renderTable(
      history({ entries: [], totalPoints: 0, wins: 0 }),
    );

    expect(
      screen.getByText("Your pick history will appear here after your first submission"),
    ).toBeTruthy();
    expect(container.querySelector("table")).toBeNull();
    expect(screen.queryByRole("table", { name: "My pick history" })).toBeNull();
  });
});
