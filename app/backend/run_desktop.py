"""Local HTTP server entrypoint for desktop / PyInstaller bundles.

Runs Flask on 127.0.0.1 using PORT from the environment (default 5055).
"""
from __future__ import annotations

import os

import app as nis_app


def main() -> None:
    port = int(os.environ.get("PORT", "5055"))
    host = os.environ.get("HOST", "127.0.0.1")
    application = nis_app.create_app()
    application.run(host=host, port=port, debug=False, threaded=True)


if __name__ == "__main__":
    main()
