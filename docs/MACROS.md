# NIS Electronic Schedule — VBA Macro Documentation

**Source file:** `NIS_ELECTRONIC_SCHEDULE_2026_v2.0.xls`  
**VBA module:** `Sheet1.cls` (attached to the "Start" worksheet)  
**Authors:** Alexander Collins / Brendhill Barton  
**Extracted:** April 2026 via olevba 0.60.2

---

## Table of Contents

1. [Sheet Layout Reference](#1-sheet-layout-reference)
2. [Constants](#2-constants)
3. [Module-Level Variables](#3-module-level-variables)
4. [Wage Ceilings & Contribution Rates — Historical Table](#4-wage-ceilings--contribution-rates--historical-table)
5. [Procedures & Functions](#5-procedures--functions)
   - [btnCreateTextFile_Click](#51-btncreatetextfile_click)
   - [Worksheet_Change](#52-worksheet_change)
   - [btnClearDetails_Click](#53-btncleardetails_click)
   - [btnPrintView_Click](#54-btnprintview_click)
   - [ClearDetails](#55-cleardetails)
   - [HandleDateError](#56-handleDateError)
   - [SetContMonth](#57-setcontmonth)
   - [ProcessSsn](#58-processssn)
   - [Lpad](#59-lpad)
   - [Rpad](#510-rpad)
   - [GetLastRow](#511-getlastrow)
   - [SetTotals](#512-settotals)
   - [SetDates](#513-setdates)
6. [Control Flow Map — Worksheet_Change](#6-control-flow-map--worksheet_change)
7. [Known Bugs & Quirks](#7-known-bugs--quirks)

---

## 1. Sheet Layout Reference

The workbook contains one active sheet named **"Start"**. All cell references below use 1-based row/column indices as used in VBA.

### Header Region (rows 1–8)

| Cell (row, col) | Field | Notes |
|-----------------|-------|-------|
| (1, 3) — C1 | **Employer Name** | Free text |
| (3, 3) — C3 | **Registration Number** | Numeric; zero-padded to 6 digits in output |
| (3, 7) — G3 | **Total Payable** | Formula: `=SUM(M10:N1500)`. Auto-recalculated by `ClearDetails`. |
| (5, 3) — C5 | **Contribution Year** | Integer year, e.g. `2026` |
| (5, 7) — G5 | **Contribution Month** | Dropdown text: `"January"` … `"December"` |
| (5, 10) — J5 | **Schedule Type** | Dropdown: `"Monthly"` or `"Weekly"` |
| (8, 5–9) — E8:I8 | **Pay Period Dates** | Up to 5 dates formatted `dd-mmm-yyyy`. Period 2–5 auto-filled in Weekly mode. |

### Employee Data Region (rows 10–1500)

| Column | Letter | Field | Type | Notes |
|--------|--------|-------|------|-------|
| 1 | A | **Over 60 flag** | Dropdown: `"Yes"` / `"No"` | Special rate applies; `"-Del-"` clears the row |
| 2 | B | **SSN** | Text | Processed by `ProcessSsn` on entry |
| 3 | C | **Surname** | Text | Auto-uppercased on entry |
| 4 | D | **First Name** | Text | Auto-uppercased on entry |
| 5 | E | **Wages Period 1** | Currency | Capped at ceiling before contribution calc |
| 6 | F | **Wages Period 2** | Currency | Weekly only; locked/blank in Monthly mode |
| 7 | G | **Wages Period 3** | Currency | Weekly only |
| 8 | H | **Wages Period 4** | Currency | Weekly only |
| 9 | I | **Wages Period 5** | Currency | Weekly only |
| 10 | J | **Weeks Worked** | Integer | Written as-is to output file; space if blank |
| 11 | K | **Total Actual Wages** | Calculated | Sum of raw (uncapped) wages; set by `SetTotals` |
| 12 | L | **Total Insurable Wages** | Calculated | Sum of capped wages; set by `SetTotals` |
| 13 | M | **Employer Contribution** | Calculated | Set by wage calc logic and `SetTotals` |
| 14 | N | **Employee Contribution** | Calculated | Set by wage calc logic; blank for over-60 |

---

## 2. Constants

All constants are declared at module scope in `Sheet1.cls`.

### Layout Constants

| Constant | Value | Meaning |
|----------|-------|---------|
| `START_ROW` | 10 | First employee data row |
| `LAST_ROW` | 1500 | Last allowed employee row |
| `BOTTOMROWNUM` | 1500 | Duplicate of `LAST_ROW`; declared but never used |
| `START_COL` | 1 | Column A (Over 60 flag) |
| `AGE_COL` | 1 | Column A — alias for Over 60 flag |
| `SSN_COL` | 2 | Column B — Social Security Number |
| `SNAME_COL` | 3 | Column C — Surname |
| `FNAME_COL` | 4 | Column D — First Name |
| `WAGE1_COL` | 5 | Column E — Wages Period 1 |
| `WAGE2_COL` | 6 | Column F — Wages Period 2 |
| `WAGE3_COL` | 7 | Column G — Wages Period 3 |
| `WAGE4_COL` | 8 | Column H — Wages Period 4 |
| `WAGE5_COL` | 9 | Column I — Wages Period 5 |
| `WKS_WK_COL` | 10 | Column J — Weeks Worked |
| `TOT_ACT_COL` | 11 | Column K — Total Actual Wages |
| `TOT_INS_COL` | 12 | Column L — Total Insurable Wages |
| `ER_COL` | 13 | Column M — Employer Contribution |
| `EE_COL` | 14 | Column N — Employee Contribution |
| `PERIOD1_COL` | 5 | Same physical column as WAGE1_COL; refers to row 8 |
| `PERIOD2_COL` | 6 | Same as WAGE2_COL |
| `PERIOD3_COL` | 7 | Same as WAGE3_COL |
| `PERIOD4_COL` | 8 | Same as WAGE4_COL |
| `PERIOD5_COL` | 9 | Same as WAGE5_COL |
| `ER_NAME_ROW` | 1 | Row 1 — Employer Name |
| `ER_NAME_COL` | 3 | Column C — Employer Name |
| `REGNO_ROW` | 3 | Row 3 — Registration Number |
| `REGNO_COL` | 3 | Column C — Reg No |
| `PAYABLE_ROW` | 3 | Row 3 — Total Payable |
| `PAYABLE_COL` | 7 | Column G — Total Payable |
| `CONT_YEAR_ROW` | 5 | Row 5 — Contribution Year |
| `CONT_YEAR_COL` | 3 | Column C — Year |
| `CONT_MONTH_ROW` | 5 | Row 5 — Contribution Month |
| `CONT_MONTH_COL` | 7 | Column G — Month |
| `SCHED_TYPE_ROW` | 5 | Row 5 — Schedule Type |
| `SCHED_TYPE_COL` | 10 | Column J — Schedule Type |
| `PERIOD_ROW` | 8 | Row 8 — Pay Period dates |

### Display Constants

| Constant | Value | Meaning |
|----------|-------|---------|
| `ZOOM_PCNT` | 80 | Zoom level applied during print preview |
| `MAX_ZOOM` | 100 | Zoom level restored after print preview |

### Rate Constants

| Constant | Value | Meaning |
|----------|-------|---------|
| `OVER_SIXTY_PCNT` | 1.5 | Contribution rate (%) for employees aged over 60 |

---

## 3. Module-Level Variables

These are declared `Dim` at module scope and persist for the lifetime of the workbook session.

| Variable | Type | Purpose |
|----------|------|---------|
| `MONTH_CEILING` | Double | Maximum insurable monthly wage for the active contribution year/month. Set inside `Worksheet_Change` from the historical table. |
| `WEEK_CEILING` | Double | Maximum insurable weekly wage. Same source. |
| `EMPLOYER_PCNT` | Double | Employer contribution percentage. Set from historical table. |
| `EMPLOYEE_PCNT` | Double | Employee contribution percentage. Set from historical table. |
| `per1…per5` | Date | Declared but never written or read — unused. |
| `regno` | String | Zero-padded registration number for file content. |
| `contYear` | String | Contribution year as string (e.g. `"2026"`). |
| `contMonth` | String | Two-digit month number (e.g. `"01"`). Set by `SetContMonth`. |
| `sched` | String | First character of schedule type (`"M"` or `"W"`). |
| `ssn, snam, fname` | String | Working variables for file generation. Note: `snam` is declared but `sname` is actually used in the code — minor naming inconsistency. |
| `period1…period5` | String | Formatted period date strings (`YYYYMMDD` or 8 spaces). |
| `wages1…wages5` | String | Formatted wage strings for file output. |
| `eeCont, erCont` | String | Formatted contribution strings for file output. |
| `targetStartCol` | Variant | Column of the cell(s) that triggered `Worksheet_Change`. |
| `targetColumns` | Variant | Rightmost column of the changed range. |
| `wagesIncluded` | Boolean | `True` if the changed range included at least one wage column. |
| `emprCalc` | Double | Calculated employer contribution (intermediate). |
| `empeCalc` | Double | Calculated employee contribution (intermediate). |
| `ovr60Calc` | Double | Calculated over-60 employer contribution (intermediate). |
| `ovr60Tot` | Double | Declared but never meaningfully used (commented-out code). |
| `otherTot` | Double | Declared but never used. |
| `schedType` | String | Current schedule type: `"Monthly"` or `"Weekly"`. |
| `contMonthNum` | Integer | Contribution month as integer (1–12) for ceiling/rate lookups. |

---

## 4. Wage Ceilings & Contribution Rates — Historical Table

These values are hard-coded inside `Worksheet_Change` as a long If/ElseIf chain. They must be replicated exactly in `settings.json`.

### Wage Ceilings

| Period | Monthly Ceiling ($) | Weekly Ceiling ($) |
|--------|--------------------|--------------------|
| Mar 2008 – Dec 2009 | 113,660 | 26,229 |
| Jan 2010 – Feb 2011 | 126,504 | 29,193 |
| Mar 2011 – Dec 2011 | 132,829 | 30,653 |
| Jan 2012 – Feb 2013 | 143,455 | 33,105 |
| Mar 2013 – Dec 2013 | 150,628 | 34,760 |
| Jan 2014 – Dec 2014 | 158,159 | 36,498 |
| Jan 2015 – Sep 2015 | 170,812 | 39,418 |
| Oct 2015 → 2026+ | 200,000 → 280,000 | 46,154 → 64,615 |

> Full year-by-year breakdown (2015 onward):

| Year | Monthly | Weekly |
|------|---------|--------|
| Oct 2015 – Dec 2016 | 200,000 | 46,154 |
| 2017 | 220,000 | 50,769 |
| 2018 | 240,000 | 55,385 |
| Jan 2019 | 240,000 | 55,385 |
| Feb 2019 → 2026 | 280,000 | 64,615 |

> **Note:** 2019 Jan uses the 2018 ceiling. From Feb 2019 onwards the ceiling jumps to 280,000 / 64,615 and remains there through 2026 (last year in the macro).

### Contribution Rates

| Period | Employer % | Employee % |
|--------|-----------|-----------|
| Before Jun 2013 | 7.8% | 5.2% |
| From Jun 2013 onward | 8.4% | 5.6% |

> **Over-60 rate:** 1.5% employer only. Employee contribution is always zero (blank) for over-60 employees.

### How the Lookup Works (VBA Logic)

```vba
' Ceiling selection — simplified pseudocode:
If (year = 2008 AND month >= 3) OR year = 2009 → 113660 / 26229
ElseIf year = 2010 OR (year = 2011 AND month < 3) → 126504 / 29193
ElseIf year = 2011 AND month >= 3 → 132829 / 30653
...

' Rate selection:
If (year > 2013) OR (year = 2013 AND month >= 6) → 8.4% / 5.6%
Else → 7.8% / 5.2%
```

---

## 5. Procedures & Functions

---

### 5.1 `btnCreateTextFile_Click`

**Type:** Private Sub (button click handler)  
**Trigger:** User clicks the "Create Text File" button on the sheet.

**Purpose:** Generates the fixed-width NIS submission text file containing one line per employee with employer contribution > 0.

**Step-by-step logic:**

1. **Guard:** If Period 1 date (E8) is empty → show error and abort.

2. **Folder picker:** Opens a Windows Shell folder-browse dialog. If user cancels (empty path) → abort.

3. **Build header values** from the sheet:
   - `regno` = registration number cell value as string, zero-padded LEFT to 6 digits if shorter.
   - `contYear` = year cell as string.
   - `contMonth` = calls `SetContMonth` to convert month name → 2-digit number string.
   - `sched` = first character of schedule type (`"M"` or `"W"`).

4. **Format each period date** (periods 1–5):
   - If the cell has a value: `YYYY` + zero-padded `MM` + zero-padded `DD` (8 chars total).
   - If blank: 8 space characters.

5. **Determine filename:**
   ```
   {rawRegNo}_{year}_{MON}_{schedChar}_ABOVE_{n}.txt
   ```
   - `rawRegNo` = raw cell value (NOT zero-padded — different from the `regno` variable used in lines).
   - `MON` = first 3 chars of month name uppercased (e.g. `"JAN"`).
   - `n` starts at 1 and increments until a non-existing filename is found.

6. **Create the text file** using `Scripting.FileSystemObject.CreateTextFile`.

7. **Iterate employee rows** from `START_ROW` (10) to `GetLastRow(...)`:
   - If Surname cell has a formula, unprotect and clear it.
   - Format fields:
     - `ssn` = right-padded to 9 chars with spaces.
     - `sname` = right-padded to 20 chars with spaces.
     - `fname` = right-padded to 15 chars with spaces.
     - `wages1–5` = `Lpad(cellValue & "00", "0", 10)` — appends "00" (cents), zero-pads to 10.
     - `erCont` = `Lpad(CStr(Round(erCell)) & "00", "0", 10)`.
     - `eeCont` = `Lpad(CStr(Round(eeCell)) & "00", "0", 10)`.
     - `wksWorked` = raw `CStr(value)` or `" "` (single space) if blank — **no padding**.
   - **Filter:** Only write the line if `Round(ER_COL value) <> 0`.
   - Write via `objFile.writeline` (adds CRLF).

8. **Completion prompt:** Offers to open the file using `ShellExecute`.

**Output file format (per line, no delimiters):**

```
[regno:6][year:4][month:2][sched:1][ssn:9][surname:20][firstname:15]
[period1:8][period2:8][period3:8][period4:8][period5:8]
[wages1:10][wages2:10][wages3:10][wages4:10][wages5:10]
[eeCont:10][erCont:10][wksWorked:variable]
```

Total fixed portion: **167 characters** per line, plus weeks worked.

---

### 5.2 `Worksheet_Change`

**Type:** Sub (worksheet event handler)  
**Trigger:** Any cell on the "Start" sheet changes value.

**Purpose:** The core reactive engine of the spreadsheet. Handles formatting, validation, auto-fill, and contribution calculation in response to every cell edit. This is the largest and most complex procedure.

**Overall structure:**

```
1. Apply border formatting to changed cells
2. Validate that required header fields are filled (if in data area)
3. Set MONTH_CEILING, WEEK_CEILING, EMPLOYER_PCNT, EMPLOYEE_PCNT from year/month
4. Branch on which region was edited:
   A. SSN / Name columns → ProcessSsn, uppercase
   B. Period date columns → validate date, call SetDates
   C. Wage columns or Over-60 column → calculate contributions, call SetTotals
   D. Schedule Type cell → lock/unlock columns, recalculate all rows
   E. Employer Name cell → no-op placeholder
```

#### Section A — Border Formatting

Runs for every cell in the changed range:
- Left/right borders: `xlContinuous`, `xlThin` for rows ≥ `START_ROW`.
- Top border: `xlMedium` for exactly `START_ROW`, `xlThin` for rows above.
- Bottom border: `xlMedium` for `LAST_ROW` and `PERIOD_ROW`, `xlThin` otherwise.
- Period date cells (row 8, cols 5–9): number format set to `dd-mmm-yyyy`.
- Wage cells in data area: right-aligned.

#### Section B — Required Field Validation

If the changed cell is in the data area OR is a wage column in the period row, AND any of these header fields are empty:
- Employer Name, Registration Number, Contribution Year, Contribution Month, Schedule Type

→ Show error, call `ClearDetails`, select the first empty required field, and **End** (halt execution).

#### Section C — Ceiling & Rate Lookup

After validation, always sets the four rate/ceiling variables from the historical table based on `contYear` and `contMonthNum`. This runs on every change, keeping the values current.

#### Section D — SSN / Name Columns (cols 2–4, rows ≥ 10)

For each cell in the changed range:
- **SSN (col 2):** If cell had a formula, clear it. Run value through `ProcessSsn`. Write back if different.
- **Surname / First Name (cols 3–4):** Force to uppercase via `UCase`.
- If the changed range also included wage columns (`wagesIncluded = True`), fall through to wage calculation.

#### Section E — Period Date Columns (cols 5–9, row 8)

For each date cell changed:
- If Period 1 (col 5) is cleared → also clear periods 2–5.
- If value is blank → skip.
- Validate year: must match `CONT_YEAR_COL` value. Exception: December of the preceding year is allowed (year-wrap for weekly schedules crossing Dec/Jan).
- Validate month: for Monthly schedules, must match the contribution month (or be January of the following year for year-wrap).
- Set number format to `dd-mmm-yyyy`.
- Call `SetDates` to auto-fill periods 2–5 (Weekly) or clear them (Monthly).

#### Section F — Wage Columns (cols 5–9, rows ≥ 10) or Over-60 Column (col 1)

1. Validate schedule type is set.
2. Validate each changed cell is numeric (show error, clear, skip if not).
3. Select ceiling (`MONTH_CEILING` or `WEEK_CEILING`) based on schedule type.
4. For each row in the changed range:
   - Clear any formula in the cell.
   - Read wages 1–5; cap each at the ceiling.
   - **If Over-60 = "No":**
     - ER = Σ `Round(wageN * EMPLOYER_PCNT / 100, 0)` for each period.
     - EE = Σ `Round(wageN * EMPLOYEE_PCNT / 100, 0)` for each period.
   - **If Over-60 = "Yes":**
     - ER = Σ `Round(wageN * OVER_SIXTY_PCNT / 100, 0)` for each period.
     - EE = blank.
   - **If Over-60 = "-Del-":** Clears cols B–N for that row, resets col A to `"No"`.
   - Set ER/EE to blank if calculated value is 0.
   - Apply `$#,##0.00` format and right-align ER/EE cells.
   - Call `SetTotals(r)`.

#### Section G — Schedule Type Cell (J5)

Triggered when schedule type changes:
- Call `SetDates`.
- **Monthly:** Lock wage columns F–I in data rows, clear their values, lock period cols F–I in row 8. Leave col E (period 1 / wage 1) unlocked.
- **Weekly:** Unlock all wage columns E–I in data rows and all period cols E–I in row 8.
- Re-protect the sheet.
- Fall through to recalculate all rows (WageCalc2 label): iterates rows 10 to `GetLastRow` and recalculates ER/EE for every employee using current ceilings and rates.

---

### 5.3 `btnClearDetails_Click`

**Type:** Private Sub (button handler)  
**Calls:** `ClearDetails`, then selects cell B10.

---

### 5.4 `btnPrintView_Click`

**Type:** Private Sub (button handler)

**Purpose:** Configures page setup and opens print preview.

- Shows a reminder to load legal-size paper.
- Sets orientation to Landscape.
- Finds the last used row (min START_ROW).
- Print area: `B1:N{lastRow}`.
- Paper size: Legal.
- Zoom: `ZOOM_PCNT` (80%) for print, then reset to `MAX_ZOOM` (100%).
- Opens `.PrintPreview` (does **not** print directly — `.PrintOut` is commented out).

---

### 5.5 `ClearDetails`

**Type:** Private Sub  
**Called by:** `btnClearDetails_Click`, `Worksheet_Change` (on validation failure)

**Actions:**
1. Disable events, unprotect sheet.
2. Set all Over-60 flags (A10:A1500) to `"No"`.
3. Clear all employee data (B10:N1500).
4. Clear period dates (E8:I8).
5. Clear and re-enter Total Payable formula: `=SUM(M10:N1500)`.
6. Re-protect sheet, re-enable events.

---

### 5.6 `HandleDateError`

**Type:** Sub  
**Parameters:** `i As Range`

A simple error handler for invalid dates. Shows an Abort/Retry/Ignore dialog and clears the offending cell. **Note:** This sub is defined but never called — the actual date error handling in `Worksheet_Change` uses a `GoTo DateErrorHandle` label inline instead.

---

### 5.7 `SetContMonth`

**Type:** Private Sub  
**Parameters:** `MonthDesc As String`  
**Side effect:** Sets the module-level `contMonth` string variable.

Converts a month name to its zero-padded 2-digit number:

| Input | Output |
|-------|--------|
| `"January"` | `"01"` |
| `"February"` | `"02"` |
| … | … |
| `"December"` | `"12"` |

Case-sensitive. No default — if the input doesn't match any month name, `contMonth` is left unchanged.

---

### 5.8 `ProcessSsn`

**Type:** Private Function  
**Parameters:** `ssn As String`  
**Returns:** Cleaned, uppercased SSN string.

**Purpose:** Sanitises user input in the SSN field to conform to NIS format.

**Steps (in order):**

1. **Remove dashes OR spaces** (only the first occurrence of either):
   ```
   "123-456789" → "123456789"
   "123 456789" → "123456789"
   ```
   Note: Only ONE pass — if both a dash and a space exist, only the dash is removed (ElseIf).

2. **Remove the letter 'O'** (capital O, not zero) anywhere in the string:
   ```
   "12O456789" → "12456789"
   ```
   Only the first occurrence is removed.

3. **Remove 'L' or 'O' from position 3** (up to 2 passes):
   ```
   "12L456789" → "12456789"
   "12O456789" → "12456789"
   ```
   Loop exits early if the new character at position 3 is numeric.

4. **Uppercase** the entire result.

**Important nuances:**
- Step 2 removes uppercase `'O'` globally before step 3 checks position 3 — so step 3's `'O'` check at position 3 is for cases where the `'O'` at position 1 earlier in the string was already removed, shifting positions.
- The function only removes a **single** separator (dash or space), not all of them.
- The loop in step 3 runs at most twice (`count = 2`), capping the number of characters removed from position 3.

---

### 5.9 `Lpad`

**Type:** Function  
**Parameters:** `MyValue`, `MyPadChar`, `MyPaddedLength`  
**Returns:** String left-padded to `MyPaddedLength` with `MyPadChar`.

```vba
Lpad = String(MyPaddedLength - Len(MyValue), MyPadChar) & MyValue
```

Example: `Lpad("500", "0", 6)` → `"000500"`

**Warning:** If `Len(MyValue) > MyPaddedLength`, `String()` is called with a negative count, which causes a runtime error. The macro assumes inputs are always shorter than the target length.

---

### 5.10 `Rpad`

**Type:** Function  
**Parameters:** `MyValue`, `MyPadChar`, `MyPaddedLength`  
**Returns:** String right-padded to `MyPaddedLength` with `MyPadChar`.

```vba
Rpad = MyValue & String(MyPaddedLength - Len(MyValue), MyPadChar)
```

Example: `Rpad("SMITH", " ", 20)` → `"SMITH               "`

Same overflow risk as `Lpad` if value is longer than the target length.

---

### 5.11 `GetLastRow`

**Type:** Function  
**Parameters:** `rg As Range`  
**Returns:** `Long` — the absolute row number of the last non-empty row within `rg`.

**Algorithm:**
- Starts from the bottom of the range and walks upward.
- Concatenates all cell values in the row; if the concatenation is empty, increments an `unused` counter.
- Stops when a non-empty row is found or the top of the range is reached.
- Returns `rg.Row + (rg.Rows.count - unused - 1)`, or `0` if the entire range is empty.

**Usage in the macro:**

The macro calls it with nested ranges to find the true last row:
```vba
GetLastRow(Range("B10:C" & GetLastRow(Range("B10:C" & GetLastRow(Range("B10:C1500"))))))
```
This triple-nesting tightens the range progressively, though in practice the outermost call is sufficient. It is functionally equivalent to a single call.

---

### 5.12 `SetTotals`

**Type:** Sub  
**Parameters:** `rw As Integer` — the row number to update.

**Purpose:** Recalculates and writes Total Actual Wages (col K), Total Insurable Wages (col L), and re-applies contributions (cols M, N) for a single employee row.

**Steps:**

1. Read wages 1–5 from the row.
2. `totActual` = sum of raw wages (uncapped).
3. Cap each wage at the ceiling.
4. `totInsurable` = sum of capped wages.
5. Write `totActual` to `TOT_ACT_COL` (if > 0; otherwise write `totInsurable`).
6. Write `totInsurable` to `TOT_INS_COL` (if > 0).
7. Recalculate ER/EE contributions from `totInsurable`:
   - Over-60 = "No": ER = `Round(totInsurable * EMPLOYER_PCNT / 100)`, EE = same with `EMPLOYEE_PCNT`.
   - Over-60 = "Yes": ER = `Round(totInsurable * OVER_SIXTY_PCNT / 100)`, EE = blank.
8. Apply `$#,##0.00` format and right-align.

**Known bugs (see §7):** `SetTotals` references `target.Row` (from `Worksheet_Change`) and `r` (a local from `Worksheet_Change`) rather than the `rw` parameter in parts of its Over-60 branch. Also writes `totWages` (unset variable) before immediately overwriting it.

---

### 5.13 `SetDates`

**Type:** Sub  
**Trigger:** Called by `Worksheet_Change` when a period date or schedule type changes.

**Purpose:** Auto-fills period dates 2–5 based on period 1.

**Logic:**
- Reads `PERIOD1_COL` value from `PERIOD_ROW`.
- Calculates dates 2–5 as period 1 + 7 days, +14 days, +21 days, +28 days (`DateAdd("d", 7, ...)` chained).
- **Monthly:** Clears periods 2–5 (only one pay period per month).
- **Weekly:** Writes the four calculated dates to periods 2–5.
- If period 1 is blank: clears all remaining periods.

---

## 6. Control Flow Map — Worksheet_Change

```
Worksheet_Change(target)
│
├── Apply borders to changed cells
│
├── [If target in data area OR wages in period row]
│   └── Validate required header fields → if any empty: ClearDetails + End
│
├── Set schedType, contYear, contMonth, contMonthNum
├── Set MONTH_CEILING, WEEK_CEILING from year/month table
├── Set EMPLOYER_PCNT, EMPLOYEE_PCNT from rate table
│
├── [If target = SSN/Name cols, row ≥ 10]
│   ├── SSN col: ProcessSsn → write back
│   ├── Name cols: UCase → write back
│   └── [If wagesIncluded] → fall through to WageCalc2
│
├── [ElseIf target = Period cols (5-9), row 8]
│   ├── Period 1 cleared → clear 2-5
│   ├── Validate year match
│   ├── Validate month match
│   ├── Format dd-mmm-yyyy
│   └── SetDates
│
├── [ElseIf target = Wage cols (5-9) or Over-60 col (1), row ≥ 10]
│   ├── Validate schedule type set
│   ├── Validate numeric
│   ├── For each row: read wages, cap at ceiling
│   ├── [Over-60 = "No"] → calc ER + EE → SetTotals
│   ├── [Over-60 = "Yes"] → calc ER only (1.5%) → SetTotals
│   └── [Over-60 = "-Del-"] → clear row B:N, reset A to "No"
│
├── [If target = Employer Name (C1)] → no-op
│
└── [ElseIf target = Schedule Type (J5)]
    ├── SetDates
    ├── Monthly: lock F-I data cols, lock F-I period cols
    ├── Weekly: unlock E-I data cols, unlock E-I period cols
    │
    WageCalc: [if Total Payable ≤ 0] → NoWage (exit)
    │
    WageCalc2:
    └── For each row 10 → GetLastRow:
        ├── Read + cap wages
        ├── [Not "Yes"] → calc ER + EE → SetTotals
        ├── ["Yes"] → calc ER only → SetTotals
        └── [totWages = 0] → blank ER + EE

NoWage: End
```

---

## 7. Known Bugs & Quirks

### Bug 1 — `SetTotals` stale variable reference
In `SetTotals(rw)`, the Over-60 "No" branch writes:
```vba
If emprCalc = 0 Then Cells(r, ER_COL).Value = ""   ' uses r, not rw
If empeCalc = 0 Then Cells(r, EE_COL).Value = ""   ' uses r, not rw
```
`r` is a local variable from `Worksheet_Change`, not a parameter to `SetTotals`. When `SetTotals` is called from the WageCalc2 loop (schedule type change path), `r` is undefined/0 — the zero-blank check silently writes to the wrong row or errors out (caught by `On Error Resume Next`).

### Bug 2 — `SetTotals` writes uninitialized `totWages`
Line: `Cells(rw, TOT_ACT_COL).Value = totWages`  
`totWages` is declared in `SetTotals` as `totWs` (unused) and `totWages` from `Worksheet_Change` does not carry over — it reads as `0`. This is immediately overwritten by the `If totActual > 0` block below, so there is no visible effect in normal operation.

### Bug 3 — `SetTotals` Over-60 "Yes" check uses `target.Row`
```vba
ElseIf Cells(target.Row, 1).Value = "Yes" Then
```
References `target` (from `Worksheet_Change` scope). When called from the mass-recalc loop this will evaluate `target.Row` — whichever row was originally edited, not `rw`. Over-60 calculation in the mass-recalc path is unreliable for rows other than the one that triggered the change.

### Bug 4 — `ProcessSsn` removes only the first separator
If an SSN has both a dash and a space (e.g. `"12-3 456"`), only the dash is removed due to the `ElseIf` structure. Multiple separators are not fully cleaned.

### Bug 5 — `HandleDateError` is never called
The sub is defined but `Worksheet_Change` uses `GoTo DateErrorHandle` (an inline label) for date errors rather than calling `HandleDateError`. The sub is dead code.

### Quirk — Sheet password is embedded in code
The sheet protection password `"white.sheet9"` appears in plain text 20+ times throughout the module. The sheet is unprotected/re-protected around every programmatic cell write.

### Quirk — `BOTTOMROWNUM` duplicates `LAST_ROW`
Both are set to 1500. `BOTTOMROWNUM` is never referenced anywhere in the code.

### Quirk — `per1…per5` declared but unused
Five `Date` module-level variables (`per1` through `per5`) are declared but never assigned or read. The actual period strings are built inline in `btnCreateTextFile_Click` using local string variables `period1`…`period5`.
