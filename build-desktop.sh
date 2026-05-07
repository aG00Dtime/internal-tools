#!/usr/bin/env bash
# One-shot desktop release build for the current machine (Linux / macOS).
# Produces installers under app/desktop/release/ (see electron-builder config).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP="${ROOT}/app/desktop"
FRONTEND="${ROOT}/app/frontend"

die() {
  echo "error: $*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command '$1' (install it and re-run this script)"
}

echo "==> NIS desktop build (repo: ${ROOT})"

need_cmd node
need_cmd npm
if ! command -v python3 >/dev/null 2>&1; then
  if command -v py >/dev/null 2>&1 && py -3 -c "import sys" >/dev/null 2>&1; then
    : # Windows Python launcher
  elif ! command -v python >/dev/null 2>&1; then
    die "missing Python 3 (need python3, or 'py' with 3.x, or python 3.8+ on PATH)"
  fi
fi

NODE_MAJOR="$(node -p "parseInt(process.versions.node.split('.')[0], 10)" 2>/dev/null || echo 0)"
if [ "${NODE_MAJOR}" -lt 18 ]; then
  die "Node.js 18+ recommended (found $(node -v))"
fi

OS="$(uname -s 2>/dev/null || echo unknown)"
case "${OS}" in
  Linux)
    if ! command -v objdump >/dev/null 2>&1; then
      echo "==> Linux: PyInstaller needs binutils (objdump)."
      if command -v apt-get >/dev/null 2>&1; then
        if sudo -n true 2>/dev/null; then
          echo "==> Installing binutils via apt (passwordless sudo available)…"
          sudo -n apt-get update -qq
          sudo -n apt-get install -y -qq binutils
        else
          die "install binutils then retry, e.g.: sudo apt-get update && sudo apt-get install -y binutils"
        fi
      else
        die "install binutils / GNU binutils so 'objdump' is on PATH, then retry"
      fi
    fi
    ;;
  Darwin)
    if ! xcode-select -p >/dev/null 2>&1; then
      die "install Xcode Command Line Tools first: xcode-select --install"
    fi
    ;;
  *)
    echo "warning: unsupported OS '${OS}' for this script; continuing anyway" >&2
    ;;
esac

if [ ! -f "${FRONTEND}/package-lock.json" ]; then
  die "missing ${FRONTEND}/package-lock.json (npm ci requires a lockfile)"
fi

echo "==> Installing desktop npm dependencies…"
(cd "${DESKTOP}" && npm install)

echo "==> Building release (frontend + PyInstaller CLI + electron-builder)…"
(cd "${DESKTOP}" && npm run dist)

echo "==> Done. Artifacts: ${DESKTOP}/release/"
