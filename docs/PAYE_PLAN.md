# PAYE File Generator — React App Plan

## Overview
Convert the GRA PAYE File Generator Excel workbook (`PAYE_File_Generator_v2026.02.26.xlsm`) into a React web application. The app replicates the spreadsheet's data-entry, real-time validation, auto-calculation, and CSV export functionality for submission to the Guyana Revenue Authority (GRA) via eServices.

Full VBA documentation: [`PAYE_MACROS.md`](./PAYE_MACROS.md)

---

## Source File Analysis

**File:** `PAYE_File_Generator_v2026.02.26.xlsm`  
**Sheets:** P.A.Y.E.-Sample (main), Reference Information (hidden dropdowns)  
**Version:** v2026.02.26

### Header Fields

| Cell | Field | Notes |
|------|-------|-------|
| A5 | Company/Agency Name | Free text, required |
| A7 | Company TIN | 9-digit numeric, required |
| B7 | Company Address | Free text |
| I2 | Year | e.g. 2022 |
| I3 | Period | e.g. 02 (month number) |
| D5 | Number of Entries | Auto: `COUNTIF(D11:D∞,"*")` |
| F5 | Total Income | Auto: `SUM(S11:S∞)` |
| H5 | Total Gross | Auto: same as F5 |
| D7 | Total Deductions | Auto: `SUM(X11:X∞)` |
| F7 | Total Tax Deducted | Auto: `SUM(Y11:Y∞)` |

---

### Employee Data Columns (header row 10, data rows 11+)

| Col | Field | Type | Required | Notes |
|-----|-------|------|----------|-------|
| A | TIN | String (9 digits) | Either A or D required | Must start with "1", exactly 9 digits if provided |
| B | Employee_Number | String | No | Internal employee ID |
| C | First_Name | String | No | |
| D | Last_Name | String | **Yes** | |
| E | Other_Names | String | No | Middle names etc. |
| F | Address | Integer | Yes | Numeric address code ≥ 1 |
| G | Pay_Frequency | Enum | **Yes** | "Daily" / "Weekly" / "Monthly" |
| H | Period_Employed | Integer | **Yes** | Daily: 1–366 · Weekly: 1–52 · Monthly: 1–12 |
| I | Employee_Type | Enum | **Yes** | "Full-Time" / "Part-Time" |
| J | Primary_Secondary_Job | Enum | **Yes** | "Primary" / "Secondary" |
| K | Value_7A_Salaries_Wages | Integer | **Yes** | Base salary/wages (no decimals) |
| L | Total_Overtime | Integer | **Yes** | Overtime amount |
| M | Second_Job_Deduction | Integer | **Yes** | Deduction for second job income |
| N | Overtime_Deduction | Integer | Yes (≥ 0) | Deduction applied to overtime |
| O | Adjusted_7A_Salaries_Wages | Integer | Auto | K + L − M − N |
| P | Value_7B_Board_Lodge | Integer | No | Board & lodging allowance |
| Q | Value_7C_Other_Taxable_Allowances | Integer | No | Other taxable allowances |
| R | Value_7C_Other_Non_Taxable_Allowances | Integer | No | Non-taxable allowances |
| S | Total_Income | Integer | **Auto** | O + P + Q + R (validated on entry) |
| T | Personal_Allowance | Integer | No | |
| U | Employee_NIS_Contribution | Integer | No | |
| V | Medical_Life_Insurance_Premiums_Deduction | Integer | No | |
| W | Children_Deduction | Integer | No | |
| X | Total_Deductions | Integer | Auto | T + U + V + W |
| Y | Tax_Deducted | Integer | **Yes** | PAYE tax withheld |
| Z | Date_Of_Birth | Date | No | Format: yyyy-mm-dd |
| AA | Bank_Name | String | No | |
| AB | Bank_Account_No | String | No | |
| AC | Bank_Account_Routing_Sort_code | String | No | |
| AD | Bank_Account_Transit_No | String | No | |
| AE | Child_Declaration_No | String | No | |

---

### Auto-calculation Rules

1. **Adjusted_7A_Salaries_Wages (O)** = K + L − M − N
2. **Total_Income (S)** = O + P + Q + R
3. **Total_Deductions (X)** = T + U + V + W

These must update live as the user edits the row.

---

### Validation Rules

**Per-cell (real-time):**
- TIN: if provided, must be numeric, exactly 9 chars, starting with "1"
- Pay_Frequency: must be "Daily", "Weekly", or "Monthly"
- Period_Employed: integer within range derived from Pay_Frequency
  - Daily → 1–366
  - Weekly → 1–52
  - Monthly → 1–12
- Employee_Type: "Full-Time" or "Part-Time"
- Primary_Secondary_Job: "Primary" or "Secondary"
- Columns K–Y: numeric, non-negative, no decimals (truncate on input)
- Total_Income (S): must equal O + P + Q + R

**On Export:**
- Company Name (A5): required
- Year (I2): required
- Company TIN (A7): must be exactly 9 digits, no letters/symbols
- At least one employee row with data
- Total income must be > 0
- Last_Name: required per row
- Address: value ≥ 1 per row

---

### CSV Export Format

**Filename:**
```
{AgencyName}_{Period}_{MM_yyyy}.csv   (when period provided)
{AgencyName}_{Year}.csv              (no period)
```
Spaces in AgencyName → underscores.

**Content:**
- Row 1: header labels (A10:AE10 from the sheet)
- Rows 2 to N: employee data rows
- Last row: **summary/totals row** inserted at position `lastRow − 8` in the original VBA (effectively appended after all data in the export)

**Summary row column mapping:**

| Col | Value |
|-----|-------|
| A | Company TIN |
| C | Company Name |
| E | `'period/year` (apostrophe-prefixed) |
| F | Company Address |
| H | Count of entries |
| K–Y | Column totals (same column as employee data) |
| Z–AE | Empty |

---

## Tech Stack

Identical to the NIS Electronic Schedule app:
- **Frontend:** React 18 + Vite
- **Styling:** matching DESIGN.md (figmaSans, black/white palette)
- **Backend:** Python Flask (for CSV generation)
- **State:** in-memory (no persistence needed — mirrors spreadsheet behaviour)

---

## Planned App Structure

```
paye-app/
  frontend/           React (Vite)
    src/
      components/
        PAYEHeader.jsx          Company info + period inputs
        EmployeeTable.jsx       Dynamic employee rows with inline calc
        ExportButton.jsx        Trigger CSV download
      lib/
        calculations.js         Auto-calc: O, S, X
        validation.js           Per-field + export validators
        csvExport.js            Build and download CSV
      App.jsx
  backend/            Python Flask
    app.py                      POST /export → returns CSV file
    requirements.txt
```

---

## Screens / Views

### 1. Main Form
- Company header section (name, TIN, address, year, period)
- Summary bar (auto-updated: entries, total income, total deductions, total tax)
- Employee table (dynamic rows, inline auto-calc, real-time validation highlighting)
- Footer: **Export CSV** button + **Clear All** button

### 2. Export Flow
- Pre-export validation — show grouped error list (matches VBA behaviour)
- On success: download CSV file directly

---

## Key Differences from NIS App

| Concern | NIS App | PAYE App |
|---------|---------|----------|
| Output format | Fixed-width .txt (Windows-1252) | Comma-separated .csv (UTF-8) |
| Calculation engine | Wage ceilings + contribution rates from settings.json | Simple arithmetic (O=K+L−M−N, S=O+P+Q+R, X=T+U+V+W) — no external config |
| Settings panel needed | Yes (rates change by year) | No — all rules are static formulas |
| Number of columns | 14 | 31 |
| Submission target | NIS | GRA eServices |
