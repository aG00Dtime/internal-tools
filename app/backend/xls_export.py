from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Any, Iterable, TYPE_CHECKING

if TYPE_CHECKING:
    import xlwt


def _to_int(value: Any) -> int:
    try:
        return int(value)
    except Exception:
        try:
            return int(float(value))
        except Exception:
            return 0


def _money_style() -> xlwt.XFStyle:
    import xlwt
    st = xlwt.XFStyle()
    st.num_format_str = "$#,##0.00"
    return st


def _header_style() -> xlwt.XFStyle:
    import xlwt
    st = xlwt.XFStyle()
    font = xlwt.Font()
    font.bold = True
    st.font = font
    return st


def _parse_iso_date(value: Any) -> datetime | None:
    if value in (None, "", 0):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        # Expect YYYY-MM-DD from the UI
        return datetime.fromisoformat(value + "T00:00:00")
    return None


def build_xls_bytes(
    *,
    employer_name: str,
    header: dict,
    period_dates: list[Any],
    employees: Iterable[dict],
) -> bytes:
    try:
        import xlwt
    except ModuleNotFoundError as e:
        raise RuntimeError(
            "Missing dependency 'xlwt' required for .xls export. "
            "Install backend requirements in the same Python environment running the server."
        ) from e

    wb = xlwt.Workbook()
    ws = wb.add_sheet("Start")

    h_st = _header_style()
    money_st = _money_style()

    # Basic header area (approximate Excel layout)
    ws.write(0, 1, "Employer Name", h_st)
    ws.write(0, 2, employer_name or "")

    ws.write(2, 1, "Registration Number", h_st)
    ws.write(2, 2, str(header.get("regNoRaw", "") or ""))

    ws.write(4, 1, "Contribution Year", h_st)
    ws.write(4, 2, _to_int(header.get("contributionYear", 0)))

    ws.write(4, 4, "Contribution Month", h_st)
    ws.write(4, 5, str(header.get("contributionMonthName", "") or ""))

    ws.write(4, 7, "Schedule Type", h_st)
    ws.write(4, 8, str(header.get("scheduleType", "") or ""))

    ws.write(7, 1, "Pay Period Dates", h_st)
    for i in range(5):
        dt = _parse_iso_date(period_dates[i] if i < len(period_dates) else None)
        if dt:
            ws.write(7, 2 + i, dt.strftime("%d-%b-%Y"))
        else:
            ws.write(7, 2 + i, "")

    # Table header
    start_row = 9  # row 10 in Excel UI
    cols = [
        "Over 60",
        "SSN",
        "Surname",
        "First Name",
        "Wages 1",
        "Wages 2",
        "Wages 3",
        "Wages 4",
        "Wages 5",
        "Weeks",
        "Total Actual",
        "Total Insurable",
        "Employer Contribution",
        "Employee Contribution",
    ]
    for c, name in enumerate(cols):
        ws.write(start_row, c, name, h_st)

    # Rows
    total_payable = 0
    r = start_row + 1
    for emp in employees:
        over60 = str(emp.get("over60", "No") or "No")
        ssn = str(emp.get("ssn", "") or "")
        surname = str(emp.get("surname", "") or "")
        firstname = str(emp.get("firstname", "") or "")
        wages = (emp.get("wages") or [])
        wages = (list(wages) + [0, 0, 0, 0, 0])[:5]
        weeks = emp.get("weeksWorked", "")

        er = emp.get("erContribution", 0) or 0
        ee = emp.get("eeContribution", 0) or 0
        total_payable += _to_int(er) + _to_int(ee)

        ws.write(r, 0, over60)
        ws.write(r, 1, ssn)
        ws.write(r, 2, surname)
        ws.write(r, 3, firstname)
        for i in range(5):
            ws.write(r, 4 + i, float(wages[i] or 0), money_st)
        ws.write(r, 9, weeks if weeks not in (None, "") else "")
        ws.write(r, 12, float(er), money_st)
        ws.write(r, 13, float(ee), money_st)
        r += 1

    # Total payable (placed under header rows)
    ws.write(8, 7, "Total Payable", h_st)
    ws.write(8, 8, float(total_payable), money_st)

    # Widths
    widths = [1800, 3200, 5200, 4200, 3000, 3000, 3000, 3000, 3000, 1800, 3200, 3200, 3600, 3600]
    for i, w in enumerate(widths):
        ws.col(i).width = w

    bio = BytesIO()
    wb.save(bio)
    return bio.getvalue()

