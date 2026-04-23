# V75 Internal NIS Electronic Schedule

A web-based version of the NIS Electronic Schedule spreadsheet, based on the source Excel template:

- **Source**: `NIS_ELECTRONIC_SCHEDULE_2026_v2.0.xls`
- **Year**: **2026**
- **Version**: **v2.0**

This app reproduces the business logic of the template (contribution calculations and the fixed-width submission file) and adds a couple of convenience features for internal workflows.

## What it generates

- **Generate file**: downloads the **official-style NIS submission `.txt`** (fixed-width, Windows-1252 encoding).
- **Export Excel (.xls)**: downloads an **internal `.xls` copy** of what you entered in the UI (for review/archiving).  
  This is **not** the NIS submission format; the NIS submission format is the `.txt`.

## App architecture

### Frontend
- **Tech**: React + Vite
- **Location**: `app/frontend/`
- **Prod serving**: static build served by nginx (in Docker)

### Backend
- **Tech**: Python + Flask
- **Location**: `app/backend/`
- **API**:
  - `GET /api/health`
  - `GET /api/settings`
  - `PUT /api/settings`
  - `POST /api/generate` (TXT)
  - `POST /api/generate-xls` (XLS)

### Settings storage (SQLite)
Settings (wage ceilings, contribution rates, defaults) are stored in SQLite:

- **Default path**: `app/backend/nis.sqlite3` (when `NIS_DB_PATH` is not set).
- **Override**: set environment variable `NIS_DB_PATH` to an absolute path (parent directories are created on startup).
- **Docker**: `NIS_DB_PATH=/app/data/nis.sqlite3` with a named volume (`nis_data`); see `app/backend/docker-entrypoint.sh`.
- **Electron desktop**: SQLite lives under the OS user-data directory (see [Offline desktop (Electron)](#offline-desktop-electron)).

### Offline desktop (Electron)
Fully offline distribution: the UI runs in Electron and calls a bundled Python CLI bridge over Electron IPC (no localhost API server). Data is stored on disk (no browser storage).

- **Code**: `app/desktop/` (main process, preload, packaging).
- **Prerequisites**: Node.js + npm, and a normal Python 3 environment for **development** mode (Electron invokes `python3 app/backend/desktop_cli.py`). For **release** builds, PyInstaller bundles the backend (Linux needs `binutils` so `objdump` is available).

**Development (Vite + Electron)**

1. Terminal A — Vite (must be on port **5173**; Electron loads this URL when unpackaged):

   ```bash
   cd app/frontend
   npm install
   npm run dev
   ```

2. Terminal B — Electron (uses direct IPC bridge in desktop mode; no local API server in packaged runtime):

   ```bash
   cd app/desktop
   npm install
   npm run dev
   ```

For **browser-only** local dev (no Electron), run Flask on 5055 (`python app.py`) and Vite as above; the UI proxies `/api` to the backend.

**Release build (installer / portable dir)**

One command from the **repository root** (installs desktop npm deps, then runs the full pipeline for your OS):

```bash
./build-desktop.sh
```

On **Windows** (PowerShell):

```powershell
.\build-desktop.ps1
```

Or manually from `app/desktop/`:

```bash
npm install
npm run dist
```

This runs a Vite production build, copies static files into `app/desktop/renderer/`, builds the `nis-backend-cli` PyInstaller binary into `app/desktop/bundle/backend/`, then runs `electron-builder` (outputs under `app/desktop/release/`).

**Where data is stored (desktop)**

- **Linux**: `~/.config/nis-electronic-schedule-desktop/nis.sqlite3` (see Electron `userData` for your OS).
- **macOS**: `~/Library/Application Support/nis-electronic-schedule-desktop/nis.sqlite3`
- **Windows**: `%APPDATA%/nis-electronic-schedule-desktop/nis.sqlite3`

**Backup / restore**: quit the app, copy `nis.sqlite3` to a safe place (restore by replacing the file while the app is closed).

**macOS / Windows builds**: run `npm run dist` on the target OS (or in CI for that OS). macOS distribution outside your org typically requires code signing and notarization. Step-by-step: [`app/desktop/MAC_BUILD.md`](app/desktop/MAC_BUILD.md).

## Run with Docker (recommended)

Prereqs: Docker Desktop (or compatible Docker daemon) with Compose support.

From the repo root:

```bash
docker compose up --build
```

Then open (host ports are defined in `docker-compose.yml`; defaults below):

- App: `http://127.0.0.1:6789`
- Health: `http://127.0.0.1:6789/api/health`

## Run locally (development)

### Backend

```bash
cd app/backend
python -m pip install -r requirements.txt
python app.py
```

Backend runs at `http://127.0.0.1:5055`.

### Frontend

```bash
cd app/frontend
npm install
npm run dev
```

Frontend runs at `http://127.0.0.1:5173` and proxies `/api/*` to `http://127.0.0.1:5055` (see `app/frontend/vite.config.js`).

## Documentation

| File | Purpose |
|------|---------|
| [`docs/PLAN.md`](docs/PLAN.md) | Architecture notes and implementation plan |
| [`docs/MACROS.md`](docs/MACROS.md) | Full VBA macro documentation and business rules |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Visual design paradigms applied to the UI |

## Notes / gotchas

- **Period 1 is required** to generate files. The UI disables export buttons until it’s set and will highlight the field if you try to export without it.
- **Oversized wage inputs** are clamped during TXT generation to avoid fixed-width formatting failures.

## Disclaimer

This app is provided **as-is** for internal use. It is **not** affiliated with or endorsed by NIS.  
Always review outputs before submission and confirm compliance with current requirements.
