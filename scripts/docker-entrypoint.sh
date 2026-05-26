#!/usr/bin/env bash
set -euo pipefail

if [[ "${RUN_MIGRATIONS:-true}" == "true" ]]; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "[ERROR] DATABASE_URL is required when RUN_MIGRATIONS=true" >&2
    exit 1
  fi

  echo "[INFO] Running database migrations..."
  bun run db:migrate
  echo "[INFO] Database migrations completed successfully."
fi

exec bun run start
