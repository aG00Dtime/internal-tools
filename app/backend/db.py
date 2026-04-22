import sqlite3
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DbPaths:
    root_dir: Path

    @property
    def db_path(self) -> Path:
        return self.root_dir / "nis.sqlite3"


DEFAULT_WAGE_CEILINGS = [
    # (from_year, from_month, monthly, weekly)
    (2008, 3, 113_660, 26_229),
    (2010, 1, 126_504, 29_193),
    (2011, 3, 132_829, 30_653),
    (2012, 1, 143_455, 33_105),
    (2013, 3, 150_628, 34_760),
    (2014, 1, 158_159, 36_498),
    (2015, 1, 170_812, 39_418),
    (2015, 10, 200_000, 46_154),
    (2017, 1, 220_000, 50_769),
    (2018, 1, 240_000, 55_385),
    (2019, 2, 280_000, 64_615),
]

DEFAULT_CONTRIBUTION_RATES = [
    # (from_year, from_month, employer_pct, employee_pct)
    (1900, 1, 7.8, 5.2),
    (2013, 6, 8.4, 5.6),
]

DEFAULT_OVER60_EMPLOYER_PCT = 1.5
DEFAULT_DEFAULT_EMPLOYER_NAME = ""
DEFAULT_DEFAULT_REG_NO = ""


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with connect(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS wage_ceilings (
              from_year INTEGER NOT NULL,
              from_month INTEGER NOT NULL,
              monthly INTEGER NOT NULL,
              weekly INTEGER NOT NULL,
              PRIMARY KEY (from_year, from_month)
            );

            CREATE TABLE IF NOT EXISTS contribution_rates (
              from_year INTEGER NOT NULL,
              from_month INTEGER NOT NULL,
              employer_pct REAL NOT NULL,
              employee_pct REAL NOT NULL,
              PRIMARY KEY (from_year, from_month)
            );

            CREATE TABLE IF NOT EXISTS app_settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            """
        )

        # Seed defaults if empty
        ceilings_count = conn.execute("SELECT COUNT(1) AS n FROM wage_ceilings").fetchone()["n"]
        if ceilings_count == 0:
            conn.executemany(
                "INSERT INTO wage_ceilings(from_year, from_month, monthly, weekly) VALUES (?, ?, ?, ?)",
                DEFAULT_WAGE_CEILINGS,
            )

        rates_count = conn.execute("SELECT COUNT(1) AS n FROM contribution_rates").fetchone()["n"]
        if rates_count == 0:
            conn.executemany(
                "INSERT INTO contribution_rates(from_year, from_month, employer_pct, employee_pct) VALUES (?, ?, ?, ?)",
                DEFAULT_CONTRIBUTION_RATES,
            )

        over60 = conn.execute(
            "SELECT value FROM app_settings WHERE key = 'over60EmployerPct'"
        ).fetchone()
        if over60 is None:
            conn.execute(
                "INSERT INTO app_settings(key, value) VALUES ('over60EmployerPct', ?)",
                (str(DEFAULT_OVER60_EMPLOYER_PCT),),
            )


def get_settings(conn: sqlite3.Connection) -> dict:
    wage_ceilings = [
        dict(r)
        for r in conn.execute(
            "SELECT from_year, from_month, monthly, weekly FROM wage_ceilings ORDER BY from_year, from_month"
        ).fetchall()
    ]
    contribution_rates = [
        dict(r)
        for r in conn.execute(
            "SELECT from_year, from_month, employer_pct, employee_pct FROM contribution_rates ORDER BY from_year, from_month"
        ).fetchall()
    ]

    def app_val(key: str, default: str = "") -> str:
        row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else default

    return {
        "wageCeilings": wage_ceilings,
        "contributionRates": contribution_rates,
        "over60EmployerPct": float(app_val("over60EmployerPct", str(DEFAULT_OVER60_EMPLOYER_PCT))),
        "defaultEmployerName": app_val("defaultEmployerName"),
        "defaultRegNo": app_val("defaultRegNo"),
    }


def replace_settings(conn: sqlite3.Connection, settings: dict) -> None:
    wage_ceilings = settings.get("wageCeilings", [])
    contribution_rates = settings.get("contributionRates", [])
    over60 = settings.get("over60EmployerPct", DEFAULT_OVER60_EMPLOYER_PCT)
    default_employer_name = settings.get("defaultEmployerName", "")
    default_reg_no = settings.get("defaultRegNo", "")

    def upsert(key: str, value: str) -> None:
        conn.execute(
            "INSERT INTO app_settings(key, value) VALUES(?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )

    with conn:
        conn.execute("DELETE FROM wage_ceilings")
        conn.execute("DELETE FROM contribution_rates")

        conn.executemany(
            "INSERT INTO wage_ceilings(from_year, from_month, monthly, weekly) VALUES (?, ?, ?, ?)",
            [
                (c["from_year"], c["from_month"], c["monthly"], c["weekly"])
                for c in wage_ceilings
            ],
        )
        conn.executemany(
            "INSERT INTO contribution_rates(from_year, from_month, employer_pct, employee_pct) VALUES (?, ?, ?, ?)",
            [
                (r["from_year"], r["from_month"], r["employer_pct"], r["employee_pct"])
                for r in contribution_rates
            ],
        )
        upsert("over60EmployerPct", str(over60))
        upsert("defaultEmployerName", default_employer_name)
        upsert("defaultRegNo", default_reg_no)


def reset_default_employer_info(conn: sqlite3.Connection) -> None:
    def upsert(key: str, value: str) -> None:
        conn.execute(
            "INSERT INTO app_settings(key, value) VALUES(?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )

    with conn:
        upsert("defaultEmployerName", DEFAULT_DEFAULT_EMPLOYER_NAME)
        upsert("defaultRegNo", DEFAULT_DEFAULT_REG_NO)


def reset_calculation_settings(conn: sqlite3.Connection) -> None:
    def upsert(key: str, value: str) -> None:
        conn.execute(
            "INSERT INTO app_settings(key, value) VALUES(?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )

    with conn:
        conn.execute("DELETE FROM wage_ceilings")
        conn.execute("DELETE FROM contribution_rates")
        conn.executemany(
            "INSERT INTO wage_ceilings(from_year, from_month, monthly, weekly) VALUES (?, ?, ?, ?)",
            DEFAULT_WAGE_CEILINGS,
        )
        conn.executemany(
            "INSERT INTO contribution_rates(from_year, from_month, employer_pct, employee_pct) VALUES (?, ?, ?, ?)",
            DEFAULT_CONTRIBUTION_RATES,
        )
        upsert("over60EmployerPct", str(DEFAULT_OVER60_EMPLOYER_PCT))

