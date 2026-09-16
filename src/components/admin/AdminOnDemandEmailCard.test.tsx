// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AdminOnDemandEmailCard,
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

  it("opens preview via a same-origin form POST in a new tab", () => {
    const originalSubmit = HTMLFormElement.prototype.submit;
    const submit = vi.fn(function (this: HTMLFormElement) {
      expect(this.target).toBe("_blank");
      expect(this.method.toLowerCase()).toBe("post");
      expect(this.action).toContain("/api/leagues/league-1/email/admin-note-preview");
      const input = this.querySelector('input[name="note"]') as HTMLInputElement | null;
      expect(input?.value).toBe("Hello league");
    });
    HTMLFormElement.prototype.submit = submit;

    try {
      renderCard();
      fireEvent.change(screen.getByLabelText("Note for participants"), {
        target: { value: "Hello league" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save & Preview" }));

      expect(submit).toHaveBeenCalledOnce();
    } finally {
      HTMLFormElement.prototype.submit = originalSubmit;
    }
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
        }),
      }),
    );

    renderCard();
    fireEvent.change(screen.getByLabelText("Note for participants"), {
      target: { value: "Kickoff moved" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Now" }));

    expect(await screen.findByText(/2 sent, 1 failed/)).toBeTruthy();
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

describe("openAdminNotePreview", () => {
  it("posts the current note without calling fetch", () => {
    const originalSubmit = HTMLFormElement.prototype.submit;
    const submit = vi.fn();
    HTMLFormElement.prototype.submit = submit;
    try {
      openAdminNotePreview("abc", "Note body");
      expect(submit).toHaveBeenCalledOnce();
    } finally {
      HTMLFormElement.prototype.submit = originalSubmit;
    }
  });
});
