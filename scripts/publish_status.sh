#!/usr/bin/env bash
set -euo pipefail

STATUS="${1:?status required}"
URL="${2:-}"
CHAT_STATUS="${3:-}"
CHAT_URL="${4:-}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

# بررسی وضعیت فعلی در gh-pages برای جلوگیری از بازنویسی اطلاعات جدید توسط وورک‌فلوی قدیمی
OLD_RUN=0
if git ls-remote --exit-code --heads "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" gh-pages > /dev/null 2>&1; then
    cd "$OUT"
    git init -q
    git remote add origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
    git fetch -q --depth 1 origin gh-pages
    git checkout -q -b gh-pages origin/gh-pages
    if [ -f "assets/status.json" ]; then
        OLD_RUN=$(python3 -c "import json; print(json.load(open('assets/status.json')).get('run_number', 0))" 2>/dev/null || echo "0")
    fi
    find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
else
    cd "$OUT"
    git init -q
    git checkout -q -b gh-pages
fi

# اگر این وورک فلو از وورک فلو منتشر شده قدیمی‌تر است، لغو کن
CURRENT_RUN="${GITHUB_RUN_NUMBER:-0}"
if [ "$CURRENT_RUN" -lt "$OLD_RUN" ]; then
    echo "Current run ($CURRENT_RUN) is older than published run ($OLD_RUN). Aborting to prevent overwriting."
    exit 0
fi

cp -R "$ROOT/pages/." .
touch .nojekyll
mkdir -p assets

python3 - "assets/status.json" "$STATUS" "$URL" "$CHAT_STATUS" "$CHAT_URL" <<'PY'
import datetime, json, os, sys
path, status, url, chat_status, chat_url = sys.argv[1:6]
server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
repo = os.environ["GITHUB_REPOSITORY"]
run_id = os.environ.get("GITHUB_RUN_ID", "")
b64 = lambda s: __import__("base64").b64encode(s.encode()).decode() if s else None
data = {
    "status": status,
    "url_payload": b64(url),
    # Second service: Unicollect Chat (llama.cpp chat model behind its own tunnel).
    "chat_status": chat_status or None,
    "chat_url_payload": b64(chat_url),
    "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    "run_url": f"{server}/{repo}/actions/runs/{run_id}" if run_id else None,
    "run_number": int(os.environ.get("GITHUB_RUN_NUMBER", 0)),
    "commit": os.environ.get("GITHUB_SHA", "")[:7],
}
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
PY

git add -A
git -c user.name="github-actions[bot]" \
    -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -q -m "status: ${STATUS} ${URL}"
    
for attempt in 1 2 3; do
    if git push -q "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" gh-pages; then
        echo "Published '${STATUS}' ${URL} to gh-pages (Run $CURRENT_RUN)"
        exit 0
    fi
    sleep $((attempt * 3))
done
echo "::warning::Could not push status page to gh-pages"
exit 1