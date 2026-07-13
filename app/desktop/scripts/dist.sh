#!/usr/bin/env bash
# Renderer + PyInstaller backend + electron-builder.
# On macOS, if the builder fails and the log does not look like a notarization failure,
# retry once with CSC_* cleared so an unsigned DMG/ZIP can still be produced.
set -euo pipefail

DESKTOP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${DESKTOP_DIR}"

npm run build:renderer
npm run build:backend

LOG="$(mktemp "${TMPDIR:-/tmp}/nis-electron-dist.XXXXXX")"
cleanup() { rm -f "${LOG}"; }
trap cleanup EXIT

set +e
electron-builder "$@" 2>&1 | tee "${LOG}"
first_builder_exit="${PIPESTATUS[0]}"
set -e

if [[ "${first_builder_exit}" -eq 0 ]]; then
  exit 0
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  exit "${first_builder_exit}"
fi

# Do not strip signing if the failure was from custom afterSign / notarytool.
if grep -qiE 'notarytool|Notarizing|Failed to notarize|@electron/notarize' "${LOG}"; then
  echo "error: electron-builder failed (notarization-related); not retrying unsigned." >&2
  exit "${first_builder_exit}"
fi

echo "warn: electron-builder failed; retrying without macOS code signing (CSC_* unset, CSC_IDENTITY_AUTO_DISCOVERY=false)." >&2

unset CSC_LINK CSC_NAME CSC_KEY_PASSWORD CSC_KEYCHAIN CSC_INSTALLER_LINK CSC_INSTALLER_KEY_PASSWORD CSC_FOR_PULL_REQUEST || true
export CSC_IDENTITY_AUTO_DISCOVERY=false

exec electron-builder "$@"
