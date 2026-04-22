from __future__ import annotations

import os
from io import BytesIO
from pathlib import Path

from flask import Flask, jsonify, make_response, request
from flask_cors import CORS

from db import DbPaths, connect, get_settings, init_db, replace_settings
from nis_format import Header, build_filename, generate_lines
from xls_export import build_xls_bytes


def create_app() -> Flask:
    here = Path(__file__).resolve().parent
    paths = DbPaths(root_dir=here)
    init_db(paths.db_path)

    app = Flask(__name__)
    CORS(app)

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True})

    @app.get("/api/settings")
    def api_get_settings():
        with connect(paths.db_path) as conn:
            return jsonify(get_settings(conn))

    @app.put("/api/settings")
    def api_put_settings():
        payload = request.get_json(force=True)
        with connect(paths.db_path) as conn:
            replace_settings(conn, payload)
            return jsonify(get_settings(conn))

    @app.post("/api/generate")
    def api_generate():
        payload = request.get_json(force=True)

        header = Header(
            reg_no_raw=str(payload["header"]["regNoRaw"]),
            contribution_year=int(payload["header"]["contributionYear"]),
            contribution_month_name=str(payload["header"]["contributionMonthName"]),
            schedule_type=str(payload["header"]["scheduleType"]),
        )
        period_dates = payload.get("periodDates", [])
        employees = payload.get("employees", [])

        lines = generate_lines(header=header, period_dates=period_dates, employees=employees)

        # Filename increments should be handled client-side by checking existing downloads;
        # server returns _ABOVE_1 by default.
        filename = build_filename(
            reg_no_raw=header.reg_no_raw,
            cont_year=header.contribution_year,
            cont_month_name=header.contribution_month_name,
            sched_type=header.schedule_type,
            n=int(payload.get("sequence", 1)),
        )

        body = ("\r\n".join(lines) + ("\r\n" if lines else "")).encode("cp1252", errors="strict")
        resp = make_response(body)
        resp.headers["Content-Type"] = "text/plain; charset=windows-1252"
        resp.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp

    @app.post("/api/generate-xls")
    def api_generate_xls():
        payload = request.get_json(force=True)

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

        # Mirror the existing filename scheme, but with .xls extension
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

        resp = make_response(xls_bytes)
        resp.headers["Content-Type"] = "application/vnd.ms-excel"
        resp.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", "5055"))
    host = os.environ.get("HOST", "0.0.0.0")
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host=host, port=port, debug=debug)

