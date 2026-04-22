#!/bin/sh
set -eu

DB_TARGET="${NIS_DB_PATH:-/app/data/nis.sqlite3}"

mkdir -p "$(dirname "$DB_TARGET")"

# If there's an existing bundled DB and no persisted DB yet, seed it.
if [ ! -f "$DB_TARGET" ] && [ -f "/app/nis.sqlite3" ]; then
  cp "/app/nis.sqlite3" "$DB_TARGET"
fi

# Make the app use the persisted DB location by swapping the file.
# DbPaths(root_dir=here) resolves to /app/nis.sqlite3, so keep that path as a symlink.
if [ -e "/app/nis.sqlite3" ] && [ ! -L "/app/nis.sqlite3" ]; then
  rm -f "/app/nis.sqlite3"
fi
ln -sf "$DB_TARGET" "/app/nis.sqlite3"

exec "$@"

