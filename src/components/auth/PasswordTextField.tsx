"use client";

import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField, { type TextFieldProps } from "@mui/material/TextField";
import { useId, useRef, useState } from "react";

export type PasswordTextFieldProps = Omit<TextFieldProps, "type">;

/**
 * Password TextField with an in-field eye toggle (right-aligned).
 * Defaults to masked; toggle appears while the field (or toggle) is focused.
 */
export function PasswordTextField({
  slotProps,
  fullWidth,
  disabled,
  id: idProp,
  ...rest
}: PasswordTextFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const [visible, setVisible] = useState(false);
  const [toggleVisible, setToggleVisible] = useState(false);

  const { input: inputSlotProps, htmlInput, ...otherSlotProps } = slotProps ?? {};

  return (
    <Stack
      ref={rootRef}
      onFocus={() => setToggleVisible(true)}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (rootRef.current?.contains(next)) return;
        setToggleVisible(false);
        setVisible(false);
      }}
      sx={{ width: fullWidth ? "100%" : undefined }}
    >
      <TextField
        {...rest}
        id={inputId}
        fullWidth={fullWidth}
        disabled={disabled}
        type={visible ? "text" : "password"}
        slotProps={{
          ...otherSlotProps,
          htmlInput,
          input: {
            ...inputSlotProps,
            endAdornment: (
              <InputAdornment
                position="end"
                sx={{
                  visibility: toggleVisible ? "visible" : "hidden",
                }}
              >
                <IconButton
                  type="button"
                  edge="end"
                  size="small"
                  disabled={disabled}
                  tabIndex={toggleVisible ? 0 : -1}
                  aria-hidden={!toggleVisible}
                  aria-controls={inputId}
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  onPointerDown={(event) => {
                    // Keep input focus so the toggle stays visible while pressing.
                    event.preventDefault();
                  }}
                  onClick={() => setVisible((prev) => !prev)}
                  sx={{ minWidth: 40, minHeight: 40 }}
                >
                  {visible ? (
                    <VisibilityOffIcon fontSize="small" />
                  ) : (
                    <VisibilityIcon fontSize="small" />
                  )}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </Stack>
  );
}
