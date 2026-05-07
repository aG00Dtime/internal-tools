#!/usr/bin/env bash
# PyInstaller bundle for the Electron "extraResources" backend. Works on Unix
# and on Windows (Git Bash / MSYS) where a venv uses Scripts\ instead of bin/.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="$(cd "${DESKTOP_DIR}/../backend" && pwd)"
OUT="${DESKTOP_DIR}/bundle/backend"
WORK="${DESKTOP_DIR}/bundle/pyinstaller-work"
VENV="${DESKTOP_DIR}/bundle/build-venv"

die() { echo "error: $*" >&2; exit 1; }

# Prefer python3, then the Windows "py" launcher, then "python" (PEP 394 is not always followed on Windows).
if command -v python3 >/dev/null 2>&1; then
  BASE_PY=(python3)
elif command -v py >/dev/null 2>&1 && py -3 -c "import sys" >/dev/null 2>&1; then
  BASE_PY=(py -3)
elif command -v python >/dev/null 2>&1; then
  BASE_PY=(python)
else
  die "no Python 3 on PATH (install Python 3 or add python3 / py to PATH)"
fi
"${BASE_PY[@]}" -c "import sys; assert sys.version_info>=(3,8)" >/dev/null 2>&1 || \
  die "Python 3.8+ is required (found: ${BASE_PY[*]})"

# Resolve the interpreter inside the venv (Layout differs on Windows vs macOS/Linux.)
if [ -x "${VENV}/bin/python" ]; then
  VENV_PY="${VENV}/bin/python"
elif [ -f "${VENV}/Scripts/python.exe" ]; then
  VENV_PY="${VENV}/Scripts/python.exe"
else
  VENV_PY=""
fi

if [ -z "${VENV_PY}" ]; then
  rm -rf "${VENV}"
  "${BASE_PY[@]}" -m venv "${VENV}"
  if [ -x "${VENV}/bin/python" ]; then
    VENV_PY="${VENV}/bin/python"
  elif [ -f "${VENV}/Scripts/python.exe" ]; then
    VENV_PY="${VENV}/Scripts/python.exe"
  else
    die "venv was created but no python found under ${VENV}"
  fi
fi

rm -rf "${OUT}"
mkdir -p "${OUT}"

"${VENV_PY}" -m pip install --upgrade pip >/dev/null
"${VENV_PY}" -m pip install -r "${BACKEND_DIR}/requirements.txt" pyinstaller

cd "${BACKEND_DIR}"

"${VENV_PY}" -m PyInstaller --noconfirm --clean \
  --onefile \
  --name "nis-backend-cli" \
  --distpath "${OUT}" \
  --workpath "${WORK}" \
  desktop_cli.py \
  --hidden-import=xlwt

echo "Backend bundle written to ${OUT}"
