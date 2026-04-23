#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="$(cd "${DESKTOP_DIR}/../backend" && pwd)"
OUT="${DESKTOP_DIR}/bundle/backend"
WORK="${DESKTOP_DIR}/bundle/pyinstaller-work"
VENV="${DESKTOP_DIR}/bundle/build-venv"

rm -rf "${OUT}"
mkdir -p "${OUT}"

if [ ! -x "${VENV}/bin/python" ]; then
  rm -rf "${VENV}"
  python3 -m venv "${VENV}"
fi
"${VENV}/bin/pip" install --upgrade pip >/dev/null
"${VENV}/bin/pip" install -r "${BACKEND_DIR}/requirements.txt" pyinstaller

cd "${BACKEND_DIR}"

"${VENV}/bin/pyinstaller" --noconfirm --clean \
  --onefile \
  --name "nis-backend-cli" \
  --distpath "${OUT}" \
  --workpath "${WORK}" \
  desktop_cli.py \
  --hidden-import=xlwt

echo "Backend bundle written to ${OUT}"
