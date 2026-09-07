// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TUESDAY_DIGEST_FIRST_WEEK_DISABLED_LABEL } from "@/lib/email/has-concluded-first-competition-week";

import { AdminEmailComposer } from "./AdminEmailComposer";

afterEach(() => {
  cleanup();
});

const theme = createTheme({ palette: { mode: "dark" } });

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function renderComposer(digestAvailable: boolean) {
  return render(
    <ThemeProvider theme={theme}>
      <AdminEmailComposer
        leagueId="league-1"
        weekNumber={1}
        digestAvailable={digestAvailable}
      />
    </ThemeProvider>,
  );
}

describe("AdminEmailComposer", () => {
  it("disables note and send controls before the first week concludes", () => {
    renderComposer(false);

    const note = screen.getByLabelText("Optional note for participants");
    expect(note).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Preview" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Send Now" })).toHaveProperty("disabled", true);
    expect(screen.getByText(TUESDAY_DIGEST_FIRST_WEEK_DISABLED_LABEL)).toBeTruthy();
  });

  it("enables note and send controls after the first week concludes", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ weekNumber: 2, bodyText: null, sentAt: null }),
      }),
    );

    renderComposer(true);

    expect(screen.getByLabelText("Optional note for participants")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preview" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send Now" })).toBeTruthy();
    expect(screen.queryByText(TUESDAY_DIGEST_FIRST_WEEK_DISABLED_LABEL)).toBeNull();

    vi.unstubAllGlobals();
  });
});
