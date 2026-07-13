# PAYE File Generator — VBA Macro Documentation

**Source file:** `PAYE_File_Generator_v2026.02.26.xlsm`  
**Author:** G. Miller (referenced in comments)  
**Version:** v2026.02.26

---

## Module: Sheet1.cls

### `exportPAYEData()`

Main export routine. Triggered by the "Export" button on the sheet.

**Flow:**
1. Clears formatting on all data rows (A11:AE∞), calls `setFormat`
2. Validates header fields: company name (A5) and date (I2)
3. Counts entries (D5) and total income (F5) — exits if both are zero
4. Finds last row by `End(xlUp)` on column D
5. Iterates rows 11 → lastRow, validating each field and accumulating column totals
6. Shows grouped error message if any validation failures found
7. Validates company TIN (A7): must be exactly 9 digits, no letters/symbols
8. Builds output CSV filename
9. Creates a temporary workbook, copies A10:AE{lastRow} into it
10. Writes a summary/totals row at position `lastRow - 8` in the temp workbook
11. Saves temp workbook as CSV, then closes it

**Filename format:**
```
{AgencyName}_{Period}_{MM_yyyy}.csv    (if period I3 is populated)
{AgencyName}_{Year}.csv                (if period I3 is blank)
```
- Spaces in AgencyName replaced with underscores
- Path = same directory as the xlsm file

**Summary row position:** `lastRow - 8` (hard-coded threshold of 8 rows above last data row)

**Summary row fields in the CSV:**

| Col | Value |
|-----|-------|
| A | Company TIN (as text string) |
| C | Company Name |
| E | `'period/year` (prefixed with `'` so Excel treats as text) |
| F | Company Address |
| H | Number of entries |
| K | Sum of Value_7A_Salaries_Wages |
| L | Sum of Total_Overtime |
| M | Sum of Second_Job_Deduction |
| N | Sum of Overtime_Deduction |
| O | Sum of Adjusted_7A_Salaries_Wages |
| P | Sum of Value_7B_Board_Lodge |
| Q | Sum of Value_7C_Other_Taxable_Allowances |
| R | Sum of Value_7C_Other_Non_Taxable_Allowances |
| S | Sum of Total_Income |
| T | Sum of Personal_Allowance |
| U | Sum of Employee_NIS_Contribution |
| V | Sum of Medical_Life_Insurance_Premiums_Deduction |
| W | Sum of Children_Deduction |
| X | Sum of Total_Deductions |
| Y | Sum of Tax_Deducted |
| Z–AE | Empty strings |

---

### Validation Rules (in `exportPAYEData`)

| Column | Check |
|--------|-------|
| A (TIN) | Either A or D must have a value; if A has value, length must be exactly 9 |
| D (Last_Name) | Must not be empty |
| F (Address) | Value must be ≥ 1 |
| G (Pay_Frequency) | Must not be empty; validated against `["Daily","Weekly","Monthly"]` via `IterateArray` |
| H (Period_Employed) | Must not be empty |
| I (Employee_Type) | Must not be empty; validated against `["Full-Time","Part-Time"]` |
| J (Primary_Secondary_Job) | Must not be empty; validated against `["First","Second"]` |
| K (Value_7A_Salaries_Wages) | Must not be empty |
| L (Total_Overtime) | Must not be empty |
| M (Second_Job_Deduction) | Must not be empty |
| N (Overtime_Deduction) | Value must be ≥ -1 (i.e., effectively ≥ 0) |
| O (Adjusted_7A) | Value must be ≥ -1 |
| S (Total_Income) | Value must be ≥ -1 (another check at row N) |
| T (Personal_Allowance) | Value must be ≥ -1 |
| U (Employee_NIS_Contribution) | Value must be ≥ -1 |
| Y (Tax_Deducted) | Must not be empty |
| X (Total_Deductions) | Value must be ≥ -1 |
| A7 (Company TIN) | Must be exactly 9 numeric digits (Like "#########") |

---

### `setFormat()`

Sets the date format on column Z (Date_Of_Birth):
```
Range("Z11:Z∞").NumberFormat = "yyyy-mm-dd"
```

---

### `IterateArray(arr, Range)`

Validates that a cell's value is NOT in the provided array. Highlights as "Bad" if the value matches (inverted logic — this appears to flag values that partially match when they shouldn't, e.g., typing "monthly" vs "Monthly").

```vba
Find = Filter(arr, Range)
If UBound(Find, 1) - LBound(Find, 1) > 0 Then Range.Style = "Bad"
```

---

### `Worksheet_Change(ByVal Target As Range)` (real-time validation)

Fires on every cell edit in Sheet1. Validates:

**Column A (TIN):**
- If non-empty: must be numeric, exactly 9 digits, starting with "1"
- Highlights "Bad" and increments error count if invalid

**Column G (Pay_Frequency):**
- Not validated here (validated in `exportPAYEData`)

**Column H (Period_Employed):**
- Reads frequency from column G (same row)
- Allowed ranges:
  - Daily: 1–366
  - Weekly: 1–52
  - Monthly: 1–12
- Clears cell and marks "Bad" if out of range or frequency not set

**Column I (Employee_Type):**
- Must be exactly "Full-Time" or "Part-Time"
- Clears cell and marks "Bad" if invalid

**Column J (Primary_Secondary_Job):**
- Must be exactly "Primary" or "Secondary"
- Clears cell if invalid

**Columns K–Y (numeric fields, dynamic):**
- Must be numeric if non-empty
- Must be ≥ 0 (negative values → "Bad")
- Decimals → truncated to integer

**Column S (Total_Income) — special check:**
- Must equal `O + P + Q + R`:
  - Adjusted_7A_Salaries_Wages + Value_7B_Board_Lodge + Value_7C_Other_Taxable + Value_7C_Other_Non_Taxable

---

## Module: Sheet2.cls

Empty — no code. Sheet2 is the hidden "Reference Information" sheet containing dropdown source data.

---

## Reference Information Sheet (Sheet2 — hidden)

Provides dropdown source lists used by data validation on Sheet1:

| Column G | Column H | Column I |
|----------|----------|----------|
| Daily    | Full-Time | Primary |
| Weekly   | Part-Time | Secondary |
| Monthly  |          |          |

Also contains a data validation rule on E2:E3 requiring Last Name length ≥ 1.
