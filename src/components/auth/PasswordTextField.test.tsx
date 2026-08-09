// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PasswordTextField } from "./PasswordTextField";

afterEach(() => {
  cleanup();
});

const theme = createTheme({ palette: { mode: "dark" } });

function renderField() {
  return render(
    <ThemeProvider theme={theme}>
      <PasswordTextField label="Password" name="password" />
    </ThemeProvider>,
  );
}

describe("PasswordTextField", () => {
  it("defaults to a masked password input", () => {
    renderField();
    const input = screen.getByLabelText("Password");
    expect(input).toHaveProperty("type", "password");
  });

  it("shows the eye toggle on focus and toggles visibility", () => {
    renderField();
    const input = screen.getByLabelText("Password");
    fireEvent.focus(input);

    const show = screen.getByRole("button", { name: "Show password" });
    expect(show).toBeTruthy();
    fireEvent.click(show);
    expect(input).toHaveProperty("type", "text");

    const hide = screen.getByRole("button", { name: "Hide password" });
    fireEvent.click(hide);
    expect(input).toHaveProperty("type", "password");
  });

  it("remasks and hides the toggle when focus leaves the field", () => {
    renderField();
    const input = screen.getByLabelText("Password");
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveProperty("type", "text");

    fireEvent.blur(input, { relatedTarget: null });
    expect(input).toHaveProperty("type", "password");
    expect(screen.queryByRole("button", { name: "Show password" })).toBeNull();
  });
});
