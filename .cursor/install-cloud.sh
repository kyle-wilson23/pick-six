#!/usr/bin/env bash
# Idempotent Cloud Agent install. Builds keep disk state only, so uv must
# land on the default PATH (/usr/local/bin). ~/.local/bin and shell rc edits
# from the official installer are not visible to the next agent shell.
set -euo pipefail

if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh

  uv_bin="$HOME/.local/bin"
  if [[ ! -x "$uv_bin/uv" && -x "$HOME/.cargo/bin/uv" ]]; then
    uv_bin="$HOME/.cargo/bin"
  fi

  sudo install -m 755 "$uv_bin/uv" /usr/local/bin/uv
  sudo install -m 755 "$uv_bin/uvx" /usr/local/bin/uvx
fi

uv --version
