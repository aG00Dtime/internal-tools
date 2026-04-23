from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_EVEN
from typing import Any, Iterable


def lpad(value: str, pad_char: str, padded_length: int) -> str:
    if len(value) > padded_length:
        raise ValueError(f"Value too long to lpad: {value!r} ({len(value)}>{padded_length})")
    return (pad_char * (padded_length - len(value))) + value


def rpad(value: str, pad_char: str, padded_length: int) -> str:
    if len(value) > padded_length:
        raise ValueError(f"Value too long to rpad: {value!r} ({len(value)}>{padded_length})")
    return value + (pad_char * (padded_length - len(value)))


def vba_round_0(x: float | Decimal) -> int:
    # VBA Round() is banker's rounding (round-half-to-even).
    d = x if isinstance(x, Decimal) else Decimal(str(x))
    return int(d.quantize(Decimal("1"), rounding=ROUND_HALF_EVEN))


def process_ssn(ssn: str) -> str:
    s = ssn or ""
    if "-" in s:
        s = s.replace("-", "", 1)
    elif " " in s:
        s = s.replace(" ", "", 1)

    if "O" in s:
        s = s.replace("O", "", 1)

    count = 0
    while len(s) >= 3 and count < 2 and s[2] in ("L", "O"):
        s = s[:2] + s[3:]
        count += 1
        if len(s) >= 3 and s[2].isdigit():
            break

    return s.upper()


def yyyymmdd_or_spaces(value: Any) -> str:
    if value in (None, "", 0):
        return " " * 8
    if isinstance(value, str):
        # Accept ISO date strings.
        dt = datetime.fromisoformat(value).date()
    elif isinstance(value, datetime):
        dt = value.date()
    elif isinstance(value, date):
        dt = value
    else:
        raise ValueError("Unsupported date value")

    return f"{dt.year:04d}{dt.month:02d}{dt.day:02d}"


@dataclass(frozen=True)
class Header:
    reg_no_raw: str
    contribution_year: int
    contribution_month_name: str
    schedule_type: str  # "Monthly" / "Weekly"


def month_name_to_number(month_name: str) -> str:
    months = {
        "January": "01",
        "February": "02",
        "March": "03",
        "April": "04",
        "May": "05",
        "June": "06",
        "July": "07",
        "August": "08",
        "September": "09",
        "October": "10",
        "November": "11",
        "December": "12",
    }
    return months[month_name]


def build_filename(reg_no_raw: str, cont_year: int, cont_month_name: str, sched_type: str, n: int) -> str:
    mon = cont_month_name[:3].upper()
    sched_char = (sched_type or "")[:1].upper()
    return f"{reg_no_raw}_{cont_year}_{mon}_{sched_char}_ABOVE_{n}.txt"


def format_money_cell_as_cents_string(value: Any) -> str:
    # VBA uses: cellValue & "00", then lpad to 10.
    # We interpret value as an integer dollar amount string, like Excel would display without decimals.
    if value in (None, ""):
        raw_int = 0
    else:
        raw_int = int(Decimal(str(value)).to_integral_value(rounding=ROUND_HALF_EVEN))

    # Fixed-width field is 10 chars including "00" cents → dollars portion must be <= 8 digits.
    # The Excel template effectively constrains wages; in the app we clamp to avoid server 500s.
    if raw_int < 0:
        raw_int = 0
    if raw_int > 99_999_999:
        raw_int = 99_999_999

    raw = str(raw_int) if raw_int != 0 else ""
    return lpad(f"{raw}00", "0", 10)


def format_rounded_contribution(value: Any) -> str:
    rounded = vba_round_0(Decimal(str(value or 0)))
    return lpad(f"{rounded}00", "0", 10)


def generate_lines(
    *,
    header: Header,
    period_dates: list[Any],
    employees: Iterable[dict],
) -> list[str]:
    reg_raw = str(header.reg_no_raw or "").strip()
    if len(reg_raw) > 6:
        raise ValueError(
            "Employer registration number must be at most 6 characters (NIS fixed-width record)."
        )
    regno = lpad(reg_raw, "0", 6)
    cont_year = str(header.contribution_year)
    cont_month = month_name_to_number(header.contribution_month_name)
    sched = (header.schedule_type or "")[:1].upper()

    periods = [yyyymmdd_or_spaces(p) for p in (period_dates + [None] * 5)[:5]]

    out: list[str] = []
    for emp in employees:
        er_value = emp.get("erContribution", 0)
        if vba_round_0(Decimal(str(er_value or 0))) == 0:
            continue

        # In Excel the SSN is cleaned by ProcessSsn on entry; we apply it again
        # defensively at generation time to avoid width/runtime errors.
        ssn_clean = process_ssn(str(emp.get("ssn") or "")).strip()
        if len(ssn_clean) > 9:
            ssn_clean = ssn_clean[:9]
        ssn = rpad(ssn_clean, " ", 9)
        surname = rpad((emp.get("surname") or "").strip(), " ", 20)
        firstname = rpad((emp.get("firstname") or "").strip(), " ", 15)

        wages = emp.get("wages", []) or []
        wages = (wages + [""] * 5)[:5]
        wages_fmt = [format_money_cell_as_cents_string(w) for w in wages]

        ee_fmt = format_rounded_contribution(emp.get("eeContribution", 0))
        er_fmt = format_rounded_contribution(er_value)

        wks = emp.get("weeksWorked", "")
        wks_str = " " if wks in (None, "") else str(wks)

        line = (
            regno
            + cont_year
            + cont_month
            + sched
            + ssn
            + surname
            + firstname
            + "".join(periods)
            + "".join(wages_fmt)
            + ee_fmt
            + er_fmt
            + wks_str
        )
        out.append(line)
    return out

