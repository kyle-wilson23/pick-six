// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AdminOnDemandEmailCard,
  formatAdminNoteFailureLine,
  openAdminNotePreview,
} from "./AdminOnDemandEmailCard";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const theme = createTheme({ palette: { mode: "dark" } });

function renderCard() {
  return render(
    <ThemeProvider theme={theme}>
      <AdminOnDemandEmailCard leagueId="league-1" />
    </ThemeProvider>,
  );
}

describe("AdminOnDemandEmailCard", () => {
  it("disables Save & Preview and Send Now until the note has text", () => {
    renderCard();

    expect(screen.getByRole("button", { name: "Save & Preview" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "Send Now" })).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Note for participants"), {
      target: { value: "   " },
    });
    expect(screen.getByRole("button", { name: "Save & Preview" })).toHaveProperty(
      "disabled",
      true,
    );

    fireEvent.change(screen.getByLabelText("Note for participants"), {
      target: { value: "Make your picks" },
    });
    expect(screen.getByRole("button", { name: "Save & Preview" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.getByRole("button", { name: "Send Now" })).toHaveProperty("disabled", false);
  });

  it("opens a tab then POSTs the note with fetch", async () => {
    const tab = {
      close: vi.fn(),
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      opener: {} as Window | null,
    };
    const openMock = vi.fn(() => tab);
    vi.stubGlobal("open", openMock);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "<html>preview</html>",
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderCard();
    fireEvent.change(screen.getByLabelText("Note for participants"), {
      target: { value: "Hello league" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save & Preview" }));

    expect(openMock).toHaveBeenCalledWith("about:blank", "_blank");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/leagues/league-1/email/admin-note-preview",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: "Hello league" }),
        }),
      );
    });
    expect(tab.document.write).toHaveBeenCalledWith("<html>preview</html>");
    expect(tab.opener).toBeNull();
  });

  it("shows the CSRF error in the card instead of a JSON tab", async () => {
    const tab = {
      close: vi.fn(),
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      opener: {} as Window | null,
    };
    vi.stubGlobal(
      "open",
      vi.fn(() => tab),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { code: "FORBIDDEN", message: "Invalid origin" } }),
        text: async () => "",
      }),
    );

    renderCard();
    fireEvent.change(screen.getByLabelText("Note for participants"), {
      target: { value: "Hello league" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save & Preview" }));

    expect(await screen.findByText("Invalid origin")).toBeTruthy();
    expect(screen.getByRole("alert").className).toContain("MuiAlert-standardWarning");
    expect(tab.close).toHaveBeenCalledOnce();
    expect(tab.document.write).not.toHaveBeenCalled();
  });

  it("POSTs the note to the send route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        sent: 2,
        failed: 0,
        sentAt: "2026-09-16T12:00:00.000Z",
        suppressed: false,
        wouldSendCount: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderCard();
    fireEvent.change(screen.getByLabelText("Note for participants"), {
      target: { value: "Kickoff moved" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Now" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/leagues/league-1/email/admin-note",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: "Kickoff moved" }),
        }),
      );
    });
    expect(await screen.findByText(/2 members reached/)).toBeTruthy();
    expect(screen.getByRole("alert").className).toContain("MuiAlert-standardSuccess");
  });

  it("shows a warning Alert when some members fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          sent: 2,
          failed: 1,
          sentAt: "2026-09-16T12:00:00.000Z",
          suppressed: false,
          wouldSendCount: 0,
          failures: [
            {
              membershipId: "mem-3",
              email: "pat@example.com",
              displayName: "Pat Lee",
              reason: "provider_error",
              error: "validation_error: 422: Invalid `to` field",
            },
          ],
        }),
      }),
    );

    renderCard();
    fireEvent.change(screen.getByLabelText("Note for participants"), {
      target: { value: "Kickoff moved" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Now" }));

    expect(await screen.findByText(/2 sent, 1 failed/)).toBeTruthy();
    expect(
      screen.getByText(/These never reached Resend \(rejected or skipped before delivery\)/),
    ).toBeTruthy();
    expect(
      screen.getByText("Pat Lee (pat@example.com) — validation_error: 422: Invalid `to` field"),
    ).toBeTruthy();
    expect(screen.getByRole("alert").className).toContain("MuiAlert-standardWarning");
  });

  it("encodes leagueId in the send URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        sent: 1,
        failed: 0,
        sentAt: "2026-09-16T12:00:00.000Z",
        suppressed: false,
        wouldSendCount: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ThemeProvider theme={theme}>
        <AdminOnDemandEmailCard leagueId="league/1" />
      </ThemeProvider>,
    );
    fireEvent.change(screen.getByLabelText("Note for participants"), {
      target: { value: "Kickoff moved" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Now" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/leagues/league%2F1/email/admin-note",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows the rehearsal suppress copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          sent: 0,
          failed: 0,
          sentAt: "2026-09-16T12:00:00.000Z",
          suppressed: true,
          wouldSendCount: 4,
        }),
      }),
    );

    renderCard();
    fireEvent.change(screen.getByLabelText("Note for participants"), {
      target: { value: "Practice note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Now" }));

    expect(
      await screen.findByText(/would have reached 4 member\(s\)\. No email was sent/),
    ).toBeTruthy();
  });
});

describe("formatAdminNoteFailureLine", () => {
  it("includes display name when it differs from email", () => {
    expect(
      formatAdminNoteFailureLine({
        displayName: "Pat Lee",
        email: "pat@example.com",
        error: "daily quota exceeded",
      }),
    ).toBe("Pat Lee (pat@example.com) — daily quota exceeded");
  });

  it("omits a duplicate display name", () => {
    expect(
      formatAdminNoteFailureLine({
        displayName: "pat@example.com",
        email: "pat@example.com",
        error: "bounce",
      }),
    ).toBe("pat@example.com — bounce");
  });
});

describe("openAdminNotePreview", () => {
  it("returns a pop-up blocked error when window.open fails", async () => {
    vi.stubGlobal(
      "open",
      vi.fn(() => null),
    );
    const result = await openAdminNotePreview("abc", "Note body");
    expect(result).toEqual({
      ok: false,
      message: "Pop-up blocked. Allow pop-ups to preview the email.",
    });
  });
});
