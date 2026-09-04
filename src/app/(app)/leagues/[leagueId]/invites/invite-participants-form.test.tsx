// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InviteParticipantsForm } from "./invite-participants-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const theme = createTheme({ palette: { mode: "dark" } });

function renderForm() {
  return render(
    <ThemeProvider theme={theme}>
      <InviteParticipantsForm leagueId="league-1" />
    </ThemeProvider>,
  );
}

describe("InviteParticipantsForm", () => {
  it("shows a wait dialog while invitations are sending", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => fetchPromise),
    );

    renderForm();
    fireEvent.change(screen.getByRole("textbox", { name: /email addresses/i }), {
      target: { value: "friend@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send invitations" }));

    expect(
      await screen.findByText("Invitations are being sent. Please wait."),
    ).toBeTruthy();

    resolveFetch(
      new Response(JSON.stringify({ created: 1, sent: 1, failed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Invitations are being sent. Please wait.")).toBeNull();
    });
    expect(
      screen.getByText(
        "Sent 1 invitation. Each recipient will receive an email with a signup link.",
      ),
    ).toBeTruthy();
  });
});
