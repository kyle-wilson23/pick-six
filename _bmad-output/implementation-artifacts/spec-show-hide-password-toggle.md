---
title: 'Show/hide password toggle'
type: 'feature'
created: '2026-08-09'
status: 'done'
route: 'one-shot'
---

# Show/hide password toggle

## Intent

**Problem:** Password fields on login, create-account, and reset-password stay fully masked with no way to verify typed characters before submit.

**Approach:** Add a shared in-field eye-icon toggle (right-aligned, shown while focused, default hidden) on login password plus both password and confirm fields on create-account and reset-password.

## Suggested Review Order

**Shared control**

- Focus-scoped eye toggle; remasks when focus leaves the field.
  [`PasswordTextField.tsx:17`](../../src/components/auth/PasswordTextField.tsx#L17)

- Toggle stays visible while pressing via pointerdown preventDefault.
  [`PasswordTextField.tsx:72`](../../src/components/auth/PasswordTextField.tsx#L72)

**Call sites**

- Login password field swaps to shared control.
  [`login-client.tsx:213`](../../src/app/login/login-client.tsx#L213)

- Create-account password + confirm both use the toggle.
  [`create-account-client.tsx:327`](../../src/app/create-account/create-account-client.tsx#L327)

- Reset-password new + confirm both use the toggle.
  [`reset-password-form.tsx:146`](../../src/app/reset-password/%5Btoken%5D/reset-password-form.tsx#L146)

**Tests**

- Default masked, focus toggle, remask-on-blur coverage.
  [`PasswordTextField.test.tsx:22`](../../src/components/auth/PasswordTextField.test.tsx#L22)
