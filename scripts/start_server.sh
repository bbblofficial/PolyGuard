#!/usr/bin/env bash
# Start PolyGuard with gunicorn. Models are loaded by the worker process,
# not by the Gunicorn master. Keep one worker by default to avoid duplicating
# all five models in RAM.
set -euo pipefail
cd "$(dirname "$0")/.."
export MODELS_ROOT="${MODELS_ROOT:-$PWD/models}"
exec gunicorn app.main:app \
  --workers "${WORKERS:-1}" \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:${PORT:-8000}" \
  --timeout 180 \
  --graceful-timeout 30 \
  --keep-alive 5
