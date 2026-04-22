FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps (kept minimal)
RUN pip install --no-cache-dir --upgrade pip

# Install deps first for better caching
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy application code
COPY . /app

# Persist SQLite DB outside the image layer
VOLUME ["/app/data"]
ENV NIS_DB_PATH=/app/data/nis.sqlite3

# The app uses DbPaths(root_dir=here) so we keep nis.sqlite3 in /app by default.
# We'll symlink it to the mounted volume at container start via entrypoint.
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 5055

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5055", "app:create_app()"]

