#!/usr/bin/env bash
# Publish the TryCloudflare URL to the `gh-pages` branch so GitHub Pages
# shows it at https://<owner>.github.io/<repo>/
#
# usage: scripts/publish_status.sh <starting|online|offline> [url]
# needs: GITHUB_TOKEN (contents: write) and GITHUB_REPOSITORY (set by Actions)
set -euo pipefail

STATUS="${1:?status required}"
URL="${2:-}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

cp -R "$ROOT/pages/." "$OUT/"
# status.json is generated below; pages/assets and the informational routes ship too.
touch "$OUT/.nojekyll"

python3 - "$OUT/status.json" "$STATUS" "$URL" <<'PY'
import datetime, json, os, sys
path, status, url = sys.argv[1:4]
server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
repo = os.environ["GITHUB_REPOSITORY"]
run_id = os.environ.get("GITHUB_RUN_ID", "")
data = {
    "status": status,
    "url_payload": __import__("base64").b64encode((url or "").encode()).decode() if url else None,
    "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    "run_url": f"{server}/{repo}/actions/runs/{run_id}" if run_id else None,
    "run_number": os.environ.get("GITHUB_RUN_NUMBER"),
    "commit": os.environ.get("GITHUB_SHA", "")[:7],
}
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
PY

cd "$OUT"
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="github-actions[bot]" \
    -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -q -m "status: ${STATUS} ${URL}"
# single orphan commit, force-pushed: the branch never grows
for attempt in 1 2 3; do
  if git push -q -f "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" gh-pages; then
    echo "Published '${STATUS}' ${URL} to gh-pages"
    exit 0
  fi
  sleep $((attempt * 3))
done
echo "::warning::Could not push status page to gh-pages"
exit 1
