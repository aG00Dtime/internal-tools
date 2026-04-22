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

- **Local dev**: `app/backend/nis.sqlite3`
- **Docker**: persisted in a named volume (`nis_data`) and symlinked to `/app/nis.sqlite3` in the container.

## Run with Docker (recommended)

Prereqs: Docker Desktop (or compatible Docker daemon) with Compose support.

From the repo root:

```bash
docker compose up --build
```

Then open:
- App: `http://127.0.0.1:8080`
- Health: `http://127.0.0.1:8080/api/health`

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
