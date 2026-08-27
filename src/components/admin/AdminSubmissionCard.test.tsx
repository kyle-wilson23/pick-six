// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AdminSubmittedPick } from "@/lib/admin/submitted-pick";

import { AdminSubmissionCard } from "./AdminSubmissionCard";

afterEach(() => {
  cleanup();
});

const theme = createTheme({ palette: { mode: "dark" } });

function renderCard(submittedPick: AdminSubmittedPick | null) {
  return render(
    <ThemeProvider theme={theme}>
      <AdminSubmissionCard displayName="Alice" submittedPick={submittedPick} />
    </ThemeProvider>,
  );
}

describe("AdminSubmissionCard", () => {
  it("shows a submitted check and no team name when the pick is redacted", () => {
    renderCard({ updatedAt: "2026-09-10T18:00:00.000Z" });

    expect(screen.getByText("SUBMITTED")).toBeTruthy();
    expect(screen.getByLabelText("Pick submitted")).toBeTruthy();
    expect(screen.queryByText(/Picked:/)).toBeNull();
    expect(screen.getByText(/Submitted /)).toBeTruthy();
  });

  it("shows Picked: {Team} after the window closes", () => {
    renderCard({
      teamName: "Buffalo Bills",
      teamAbbreviation: "BUF",
      antiJailedBonus: false,
      updatedAt: "2026-09-10T18:00:00.000Z",
    });

    expect(screen.getByText("SUBMITTED")).toBeTruthy();
    expect(screen.queryByLabelText("Pick submitted")).toBeNull();
    expect(screen.getByText(/Picked: Buffalo Bills/)).toBeTruthy();
  });

  it("keeps pending copy unchanged", () => {
    renderCard(null);

    expect(screen.getByText("PENDING")).toBeTruthy();
    expect(screen.getByText("No pick submitted yet")).toBeTruthy();
    expect(screen.queryByLabelText("Pick submitted")).toBeNull();
  });
});
