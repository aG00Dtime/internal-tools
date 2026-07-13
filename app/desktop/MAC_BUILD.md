# macOS build, signing, and notarization

Build **on a Mac**. The desktop release bundles:

- a **PyInstaller** binary (`nis-backend-cli`) for your Mac’s CPU architecture, and  
- an **Electron** `.app` plus **DMG** and **ZIP** (see `package.json` → `build.mac.target`).

Artifacts appear under [`release/`](release/) after a successful `npm run dist`.

---

## 1. Prerequisites

- **Xcode Command Line Tools** (compiler, `codesign`, `notarytool`, etc.):

  ```bash
  xcode-select --install
  ```

- **Python 3** (for the PyInstaller step in `scripts/build-backend.sh`).

- **Node.js + npm** (LTS recommended).

Optional but useful:

- Apple **Developer Program** membership if you need signing + notarization for distribution outside a small internal group.

---

## 2. Unsigned local build (fastest)

From this directory:

```bash
npm install
npm run dist
```

Open the generated app from `release/` (e.g. mount the **DMG** and drag the app, or unzip the **ZIP**).

**Gatekeeper:** On first launch, macOS may block an unsigned app. Users can **right‑click → Open** once, or you can sign/notarize (below).

**Architecture:** The build matches the machine you run on:

- **Apple Silicon (M1/M2/…)** → **arm64** app and **arm64** `nis-backend-cli`.  
- **Intel Mac** → **x64** app and **x64** `nis-backend-cli`.

There is **no** “universal” build in the current config. To ship both, run `npm run dist` **twice** on two machines (or in CI with two macOS runners) and publish two artifacts.

---

## 3. Code signing (distribution)

### 3.1 Find your signing identity

```bash
security find-identity -v -p codesigning
```

Pick the **Developer ID Application** identity you want (team name + hash).

### 3.2 Tell Electron Builder which identity to use

**Option A — environment variable (common in CI)**

```bash
export CSC_NAME="Developer ID Application: Your Name (TEAMID)"
npm run dist
```

**Option B — Developer ID Application certificate as a `.p12`**

```bash
export CSC_LINK=/absolute/path/to/DeveloperID.p12
export CSC_KEY_PASSWORD='your-p12-password'
npm run dist
```

Electron Builder signs the `.app` and (when configured) DMG/ZIP. Details and edge cases: [electron-builder code signing](https://www.electron.build/code-signing).

### 3.3 Hardened Runtime

Apple requires the **Hardened Runtime** for notarized apps. Electron Builder applies sensible defaults for Mac distribution builds when signing is enabled. If you customize `entitlements` or `extendInfo`, keep notarization requirements in mind.

---

## 4. Notarization (recommended for wide distribution)

Notarization is an Apple server check that **staples** a ticket to your app so Gatekeeper is smooth for users.

### 4.1 App-specific password

Create an **app-specific password** for your Apple ID (Apple ID account → Security → App-Specific Passwords). You will **not** use your normal Apple ID password.

### 4.2 Environment variables

Set these in the same shell before `npm run dist` (values are examples):

```bash
export CSC_NAME="Developer ID Application: Your Name (TEAMID)"

export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

Then:

```bash
npm run dist
```

Electron Builder will submit the signed artifact for notarization and staple when possible. If your workflow splits signing and notarization, use Apple’s **`notarytool`** / **`stapler`** manually; see [Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution).

### 4.3 Verify stapling (optional)

After a successful build, on the shipped `.app` or `.dmg`:

```bash
xcrun stapler validate /path/to/NIS\ Electronic\ Schedule.app
```

---

## 5. CI (GitHub Actions / other)

Use a **macOS** runner with:

- Xcode CLT (usually preinstalled),
- Node,
- Python,
- your signing cert injected as secrets (`CSC_LINK` + `CSC_KEY_PASSWORD`, or keychain + `CSC_NAME`),
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` for notarization.

Run from `app/desktop`:

```bash
npm ci
npm run dist
```

Cache `node_modules` and the PyInstaller venv under `bundle/build-venv` if builds are slow (ensure cache key includes `app/backend/requirements.txt`).

---

## 6. Troubleshooting

| Symptom | Things to check |
|--------|-------------------|
| `PyInstaller` fails on Mac | Python and CLT installed; rerun after `xcode-select --install`. |
| “damaged and can’t be opened” | Sign + notarize, or user uses **Open** from context menu once (unsigned). |
| Backend does not start inside the app | In **Console.app**, filter by your app name; confirm `nis-backend-cli` exists under `Contents/Resources/backend/` in the `.app`. |
| Wrong architecture | Build on the CPU class you intend to ship (arm64 vs x64). |

---

## 7. Related paths in this repo

| Item | Location |
|------|-----------|
| Electron + builder config | [`package.json`](package.json) |
| Main process (loads UI and bridges to backend CLI) | [`electron-main.cjs`](electron-main.cjs) |
| Backend bundle script | [`scripts/build-backend.sh`](scripts/build-backend.sh) |
| User data / SQLite (runtime) | `~/Library/Application Support/nis-electronic-schedule-desktop/` (see root [`README.md`](../README.md)) |
