# NIS Electronic Schedule — React App Plan

## Overview
Convert the NIS Electronic Schedule Excel file into a React web application that replicates its functionality, preserves all business logic from the VBA macros, and stores configurable parameters in a settings file.

---

## Source File Analysis
**File:** `../NIS_ELECTRONIC_SCHEDULE_2026_v2.0.xls`  
**Original author:** Alexander Collins / Brendhill Barton  
**Macros extracted from:** `Sheet1.cls` (VBA) — full documentation in [`MACROS.md`](./MACROS.md)

### Business Logic Extracted from Macros

#### Column Layout (employee data rows 10–1500)
| Col | Field |
|-----|-------|
| A (1) | Over 60? (Yes / No) |
| B (2) | SSN |
| C (3) | Surname |
| D (4) | First Name |
| E–I (5–9) | Wages Period 1–5 |
| J (10) | Weeks Worked |
| K (11) | Total Actual Wages |
| L (12) | Total Insurable Wages |
| M (13) | Employer Contribution |
| N (14) | Employee Contribution |

#### Header Fields
| Cell | Field |
|------|-------|
| Row 1, Col 3 | Employer Name |
| Row 3, Col 3 | Registration Number (6-digit, zero-padded) |
| Row 3, Col 7 | Total Payable (auto sum of M+N cols) |
| Row 5, Col 3 | Contribution Year |
| Row 5, Col 7 | Contribution Month |
| Row 5, Col 10 | Schedule Type (Monthly / Weekly) |
| Row 8, Cols 5–9 | Pay Period Dates (up to 5) |

#### Wage Ceilings (by year/month — stored in settings.json)
```
2008-03: monthly=113660, weekly=26229
2010-01: monthly=126504, weekly=29193
2011-03: monthly=132829, weekly=30653
2012-01: monthly=143455, weekly=33105
2013-03: monthly=150628, weekly=34760
2014-01: monthly=158159, weekly=36498
2015-01: monthly=170812, weekly=39418
2015-10: monthly=200000, weekly=46154
2017-01: monthly=220000, weekly=50769
2018-01: monthly=240000, weekly=55385
2019-02: monthly=256800, weekly=59262
2020-01: monthly=280000, weekly=64615
```

#### Contribution Rates (stored in settings.json)
- Pre June 2013: Employer 7.8%, Employee 5.2%
- From June 2013: Employer 8.4%, Employee 5.6%
- Over 60 (any period): Employer only at 1.5%, no employee contribution

#### Calculation Rules
1. Each wage period capped at the applicable ceiling before calculating contributions
2. Total Actual Wages = sum of raw (uncapped) wages
3. Total Insurable Wages = sum of capped wages
4. Contributions calculated per-period then summed (rounded individually)
5. If ER contribution = 0, row is excluded from output file

#### SSN Processing (`ProcessSsn`)
- Remove dashes and spaces
- Remove letter 'O' if present
- If 3rd character is 'L' or 'O', remove it (up to 2 passes)
- Convert to uppercase

#### Weekly Mode — Auto-fill Dates
- Enter Period 1 date → Periods 2–5 auto-filled as +7 days each

#### Output File Format — EXACT BYTE SPECIFICATION
Must match the VBA `objFile.writeline` output character-for-character.

**File encoding:** Windows-1252 (ANSI)  
**Line endings:** CRLF (`\r\n`) — VBA `writeline` always adds CRLF  
**Character set:** ASCII-safe (NIS field values are alphanumeric/spaces)

**Filename:**
```
{raw_regno}_{contYear}_{MON}_{sched[0]}_ABOVE_{n}.txt
```
- `raw_regno` = raw cell value as-is (NOT zero-padded — VBA uses `CStr(Cells(...).Value)`)
- `MON` = first 3 chars of month name, uppercase (e.g. `JAN`, `FEB`)
- `sched[0]` = first char of schedule type (`M` or `W`)
- `n` = auto-incremented integer starting at 1 to avoid overwriting existing files

**Record layout (one line per employee, fields concatenated with no delimiter):**

| # | Field | Width | Rule |
|---|-------|-------|------|
| 1 | regno | 6 | `CStr(regNoCell)`, then `Lpad("0", 6)` if len < 6 — zero-padded LEFT |
| 2 | contYear | 4 | Year as string (e.g. `"2026"`) |
| 3 | contMonth | 2 | Zero-padded month number (`"01"`–`"12"`) via SetContMonth |
| 4 | sched | 1 | First char of schedule type: `"M"` or `"W"` |
| 5 | ssn | 9 | `Rpad(Trim(ssnCell), " ", 9)` — space-padded RIGHT |
| 6 | surname | 20 | `Rpad(Trim(surnameCell), " ", 20)` — space-padded RIGHT, stored as-entered |
| 7 | firstname | 15 | `Rpad(Trim(firstnameCell), " ", 15)` — space-padded RIGHT, stored as-entered |
| 8 | period1 | 8 | `YYYY` + `MM` (zero-pad) + `DD` (zero-pad), or `"        "` (8 spaces) if blank |
| 9 | period2 | 8 | Same rule |
| 10 | period3 | 8 | Same rule |
| 11 | period4 | 8 | Same rule |
| 12 | period5 | 8 | Same rule |
| 13 | wages1 | 10 | `Lpad(wageCell.Value & "00", "0", 10)` — raw numeric value as string + literal "00", zero-padded LEFT to 10 |
| 14 | wages2 | 10 | Same rule |
| 15 | wages3 | 10 | Same rule |
| 16 | wages4 | 10 | Same rule |
| 17 | wages5 | 10 | Same rule |
| 18 | eeCont | 10 | `Lpad(CStr(Round(eeContCell)) & "00", "0", 10)` — rounded, then +"00", zero-padded LEFT |
| 19 | erCont | 10 | `Lpad(CStr(Round(erContCell)) & "00", "0", 10)` — same pattern |
| 20 | wksWorked | variable | `" "` (1 space) if blank, else raw `CStr(value)` — **no padding applied** |

**Filter:** A row is only written if `Round(erContCell) <> 0`.

**Critical implementation notes:**
- Wages use `Value & "00"` (integer dollar amount × 100 expressed as appended zeros, e.g. $50,000 → `"5000000"` → `"0005000000"`)
- Contributions use `CStr(Round(value)) & "00"` — VBA `Round()` uses **banker's rounding** (round-half-to-even), not standard round-half-up
- Surname and firstname are written as stored in cells (the VBA auto-uppercases on entry but the writeline uses the stored cell value, which is already uppercase)
- `wksWorked` has **no fixed width** — it is whatever `CStr(value)` returns (typically "1"–"5" for weekly)

---

## Design
All visual design decisions are specified in [`DESIGN-figma.md`](./DESIGN-figma.md). Business logic is fully documented in [`MACROS.md`](./MACROS.md).  
The React app must be built to match `DESIGN-figma.md` exactly. Key directives:

| Concern | Rule |
|---------|------|
| Colors | Strictly `#000000` and `#ffffff` for all interface chrome. No other colors. |
| Font | `figmaSans` variable font — weights 320, 330, 340, 450, 480, 540, 700 only. Fallback: SF Pro Display, system-ui |
| Mono labels | `figmaMono` uppercase, letter-spacing `+0.54px`, for section labels and column headers |
| Buttons | Pill `50px` radius for CTAs, `50%` circle for icon buttons. Black solid or white pill variants only. |
| Focus | `dashed 2px` outline — never solid |
| Letter-spacing | Negative on all body text (`-0.1px` to `-0.26px`). Positive only on figmaMono labels. |
| Borders | Black (`#000000`) thin lines — table grid, inputs |
| Shadows | Sparingly — subtle on modals/dialogs only |
| Radius | Cards/dialogs `8px`, small containers `6px`, buttons `50px` pill |

## Tech Stack (to be confirmed with user)
- **Frontend:** React (Vite)
- **Styling:** per DESIGN.md
- **Backend:** Python Flask (for file generation) OR pure React + browser download API
- **Settings storage:** `settings.json` (editable via Settings UI in the app)
- **State persistence:** localStorage (session data) or backend DB

---

## Planned App Structure

```
NIS/
  app/
    frontend/           React (Vite) app
      src/
        components/
          ScheduleHeader.jsx   Employer info fields
          PeriodRow.jsx        Pay period date inputs
          EmployeeTable.jsx    Dynamic employee rows
          SettingsModal.jsx    Edit settings.json values
        lib/
          calculations.js      NIS contribution logic
          fileGenerator.js     Fixed-width text output
          settings.js          Load/save settings
        App.jsx
    backend/            Python Flask (optional)
      app.py
    settings.json       All configurable parameters
```

---

## Screens / Views

### 1. Main Schedule Form
- Employer info header (name, reg no, year, month, schedule type)
- Period dates row (1 or 5 dates depending on Monthly/Weekly)
- Employee data table (dynamic rows, inline calculations)
- Totals footer row
- Action buttons: **Generate File**, **Clear**, **Print**, **Settings**

### 2. Settings Panel / Modal
- Edit wage ceilings table (year, month, monthly ceiling, weekly ceiling)
- Edit contribution rates (pre/post June 2013)
- Edit over-60 rate
- Add new ceiling rows (for future year updates)
- Save / Reset to defaults

---

## Waiting on User
- [ ] Design details / mockups
- [ ] Preferred styling (Tailwind, plain CSS, component library?)
- [ ] Backend needed or pure frontend with browser download?
- [ ] Any additional fields or screens beyond what's in the Excel?
