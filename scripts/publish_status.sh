#!/usr/bin/env bash
# Publishes the static site (pages/) plus assets/status.json to the gh-pages
# branch. status.json carries the current TryCloudflare link so the site can
# show live service links.
#   usage: publish_status.sh <starting|online|offline> [public_url]
set -euo pipefail

STATUS="${1:?status required}"
URL="${2:-}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"

cd "$OUT"
git init -q
git remote add origin "$REMOTE"

OLD_RUN=0
if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git fetch -q --depth 1 origin gh-pages
  git checkout -q -b gh-pages origin/gh-pages
  if [ -f assets/status.json ]; then
    OLD_RUN=$(python3 -c "import json;print(int(json.load(open('assets/status.json')).get('run_number') or 0))" 2>/dev/null || echo 0)
  fi
  find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
else
  git checkout -q -b gh-pages
fi

# An older run (e.g. one being replaced by the heartbeat's overlap run) must
# never overwrite the link published by a newer run.
CURRENT_RUN="${GITHUB_RUN_NUMBER:-0}"
if [ "$CURRENT_RUN" -lt "$OLD_RUN" ]; then
  echo "Run $CURRENT_RUN is older than published run $OLD_RUN, not overwriting."
  exit 0
fi

cp -R "$ROOT/pages/." .
touch .nojekyll
mkdir -p assets

python3 - "assets/status.json" "$STATUS" "$URL" <<'PY'
import base64, datetime, json, os, sys
path, status, url = sys.argv[1:4]
server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
repo = os.environ.get("GITHUB_REPOSITORY", "")
run_id = os.environ.get("GITHUB_RUN_ID", "")
data = {
    "status": status,
    # base64 keeps the raw link out of casual scraping of the repo
    "url_payload": base64.b64encode(url.encode()).decode() if url else None,
    "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    "run_url": f"{server}/{repo}/actions/runs/{run_id}" if run_id else None,
    "run_number": int(os.environ.get("GITHUB_RUN_NUMBER", 0) or 0),
    "commit": os.environ.get("GITHUB_SHA", "")[:7],
}
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
PY

git add -A
git -c user.name="github-actions[bot]" \
    -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -q -m "status: ${STATUS} ${URL}" || { echo "nothing to publish"; exit 0; }

for attempt in 1 2 3; do
  if git push -q origin gh-pages; then
    echo "Published '${STATUS}' ${URL} (run ${CURRENT_RUN})"
    exit 0
  fi
  sleep $((attempt * 3))
done
echo "::warning::Could not push status page to gh-pages"
exit 1
