from __future__ import annotations

import argparse
import base64
import json
import sys
from pathlib import Path

from db import DbPaths, connect, get_settings, init_db, replace_settings, reset_calculation_settings
from nis_format import Header, build_filename, generate_lines
from paye_format import build_filename as paye_build_filename
from paye_format import generate_csv as paye_generate_csv
from xls_export import build_xls_bytes


def _db_path() -> Path:
    here = Path(__file__).resolve().parent
    return DbPaths(root_dir=here).db_path


def _load_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    val = json.loads(raw)
    if not isinstance(val, dict):
        raise ValueError("Input payload must be a JSON object.")
    return val


def _json_out(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj))
    sys.stdout.flush()


def _cmd_settings_get() -> dict:
    db_path = _db_path()
    init_db(db_path)
    with connect(db_path) as conn:
        return {"settings": get_settings(conn)}


def _cmd_settings_put(payload: dict) -> dict:
    db_path = _db_path()
    init_db(db_path)
    settings = payload.get("settings", payload)
    with connect(db_path) as conn:
        replace_settings(conn, settings)
        return {"settings": get_settings(conn)}


def _cmd_settings_reset_calculation_defaults() -> dict:
    db_path = _db_path()
    init_db(db_path)
    with connect(db_path) as conn:
        reset_calculation_settings(conn)
        return {"settings": get_settings(conn)}


def _cmd_generate_txt(payload: dict) -> dict:
    header_payload = payload.get("header", {})
    header = Header(
        reg_no_raw=str(header_payload["regNoRaw"]),
        contribution_year=int(header_payload["contributionYear"]),
        contribution_month_name=str(header_payload["contributionMonthName"]),
        schedule_type=str(header_payload["scheduleType"]),
    )
    lines = generate_lines(
        header=header,
        period_dates=payload.get("periodDates", []),
        employees=payload.get("employees", []),
    )
    body = ("\r\n".join(lines) + ("\r\n" if lines else "")).encode("cp1252", errors="strict")
    filename = build_filename(
        reg_no_raw=header.reg_no_raw,
        cont_year=header.contribution_year,
        cont_month_name=header.contribution_month_name,
        sched_type=header.schedule_type,
        n=int(payload.get("sequence", 1)),
    )
    return {
        "filename": filename,
        "contentType": "text/plain; charset=windows-1252",
        "contentBase64": base64.b64encode(body).decode("ascii"),
    }


def _cmd_generate_xls(payload: dict) -> dict:
    employer_name = str(payload.get("employerName", "") or "")
    header = payload.get("header", {}) or {}
    period_dates = payload.get("periodDates", []) or []
    employees = payload.get("employees", []) or []
    xls_bytes = build_xls_bytes(
        employer_name=employer_name,
        header=header,
        period_dates=period_dates,
        employees=employees,
    )

    h = Header(
        reg_no_raw=str(header.get("regNoRaw", "")),
        contribution_year=int(header.get("contributionYear", 0) or 0),
        contribution_month_name=str(header.get("contributionMonthName", "")),
        schedule_type=str(header.get("scheduleType", "")),
    )
    base = build_filename(
        reg_no_raw=h.reg_no_raw,
        cont_year=h.contribution_year,
        cont_month_name=h.contribution_month_name,
        sched_type=h.schedule_type,
        n=int(payload.get("sequence", 1)),
    )
    filename = base.rsplit(".", 1)[0] + ".xls"
    return {
        "filename": filename,
        "contentType": "application/vnd.ms-excel",
        "contentBase64": base64.b64encode(xls_bytes).decode("ascii"),
    }


def _cmd_generate_paye_csv(payload: dict) -> dict:
    company_name = str(payload.get("companyName", "") or "")
    company_tin = str(payload.get("companyTin", "") or "")
    company_address = str(payload.get("companyAddress", "") or "")
    year = str(payload.get("year", "") or "")
    period = str(payload.get("period", "") or "")
    employees = payload.get("employees", []) or []

    csv_text = paye_generate_csv(
        company_name=company_name,
        company_tin=company_tin,
        company_address=company_address,
        year=year,
        period=period,
        employees=employees,
    )
    filename = paye_build_filename(company_name=company_name, year=year, period=period)
    return {
        "filename": filename,
        "contentType": "text/csv; charset=utf-8",
        "contentBase64": base64.b64encode(csv_text.encode("utf-8")).decode("ascii"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="NIS desktop CLI bridge")
    parser.add_argument(
        "command",
        choices=[
            "settings-get",
            "settings-put",
            "settings-reset-calculation-defaults",
            "generate-txt",
            "generate-xls",
            "generate-paye-csv",
        ],
    )
    args = parser.parse_args()

    try:
        if args.command == "settings-get":
            result = _cmd_settings_get()
        elif args.command == "settings-reset-calculation-defaults":
            result = _cmd_settings_reset_calculation_defaults()
        elif args.command == "settings-put":
            payload = _load_payload()
            result = _cmd_settings_put(payload)
        elif args.command == "generate-txt":
            payload = _load_payload()
            result = _cmd_generate_txt(payload)
        elif args.command == "generate-xls":
            payload = _load_payload()
            result = _cmd_generate_xls(payload)
        elif args.command == "generate-paye-csv":
            payload = _load_payload()
            result = _cmd_generate_paye_csv(payload)
        else:
            raise ValueError(f"Unsupported command: {args.command}")
        _json_out(result)
        return 0
    except Exception as e:
        sys.stderr.write(f"{type(e).__name__}: {e}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
