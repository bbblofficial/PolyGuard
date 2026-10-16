#!/usr/bin/env bash
# Start PolyGuard with gunicorn. Models are loaded once in the master (--preload)
# and shared with the workers through copy-on-write.
set -euo pipefail
cd "$(dirname "$0")/.."
export MODELS_ROOT="${MODELS_ROOT:-$PWD/models}"
exec gunicorn app.main:app \
  --workers "${WORKERS:-2}" \
  --worker-class uvicorn.workers.UvicornWorker \
  --preload \
  --bind "0.0.0.0:${PORT:-8000}" \
  --timeout 180 \
  --graceful-timeout 30 \
  --keep-alive 5
