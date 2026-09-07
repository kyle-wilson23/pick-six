// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { WeeklyEmailStatus } from "@/lib/admin/get-weekly-email-status";

import { AdminWeeklyEmailStatus } from "./AdminWeeklyEmailStatus";

afterEach(() => {
  cleanup();
});

const theme = createTheme({ palette: { mode: "dark" } });

function renderStatus(status: WeeklyEmailStatus) {
  return render(
    <ThemeProvider theme={theme}>
      <AdminWeeklyEmailStatus status={status} />
    </ThemeProvider>,
  );
}

describe("AdminWeeklyEmailStatus", () => {
  it("maps slot 1/2 fields to first/final pick reminder labels", () => {
    renderStatus({
      weekNumber: 1,
      nflSeasonYear: 2026,
      tuesdayDigest: { state: "skipped", reason: "no_completed_week" },
      wednesdayReminder: { state: "pending" },
      thursdayReminder: { state: "not_sent" },
    });

    expect(
      screen.getByText("Tuesday digest — Skipped (waiting for first week to finish)"),
    ).toBeTruthy();
    expect(screen.getByText("First pick reminder — Pending (scheduled)")).toBeTruthy();
    expect(screen.getByText("Final pick reminder — Not sent")).toBeTruthy();
  });
});
