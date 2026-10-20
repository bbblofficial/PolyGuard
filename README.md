# Unicollect Guard

![CI](https://github.com/bbblofficial/PolyGuard/actions/workflows/deploy.yml/badge.svg)
![Python](https://img.shields.io/badge/python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688)
![API](https://img.shields.io/badge/API-v1-900c7e)

Toxic / offensive content detection for **Persian**, **Fingilish** and **English**, decided by consensus voting across 5 models. One service: a FastAPI backend, a web panel, a full JSON API (`/api/v1`), and a public GitHub Pages site with API docs and the live link.

> v2.2: **Chat on the public site**: `pages/chat/` is the full Guard chat panel (threads, search, settings, thinking animation, result cards, breakdown) running on GitHub Pages. It finds the live service through `api/links.json`, shows a banner + retry when the service is offline, and re-reads the link when a tunnel changes. It's generated from `app/static` by `scripts/sync_chat.py` (one source of truth; `publish_status.sh` runs it, `tests/test_pages.py` checks it). New in the chat (both on Pages and the service panel): **censor button** on flagged results (`/api/v1/censor`, word mode then sentence mode), API key + custom server in settings, export/import all threads as JSON, `?text=…` opens a new chat and checks it, `Ctrl+Shift+O` new chat, faster thinking phases once the answer is back, cancelable breakdown accordion, circular theme reveal. **Site**: floating ("suspended") header that hides on scroll down / returns on scroll up, with a sliding nav pill and reading-progress line; floating footer card with link columns, live status + latency and back-to-top. **API docs**: every endpoint slides open and closed (reversible mid-animation), expand/collapse all, copy-link per endpoint, URL hash follows the open endpoint. **Animation fixes**: logo hover no longer replays the intro or leaves petals dimmed, voter bars animate with transforms, the stamp lifts off instead of vanishing, code tabs fade, staggered reveals, modals/drawer can't be tabbed into while hidden, drawer traps focus. `/chat` on the service redirects to `/site/chat/`.
>
> v2.1: Fonts are self-hosted (Vazirmatn + JetBrains Mono as subset variable WOFF2 in `pages/assets/fonts` and `app/static/fonts`, preloaded, `font-display: swap`), so Persian renders correctly even when Google Fonts is slow or blocked. GitHub Pages restyled to match the chat panel, 404 page with working assets, live check on the home page, endpoint search + copy-as-curl in the docs, SVG icons instead of emoji, Python examples use plain `requests` (no client package).
>
> v2.0: the chat model (Unicollect Chat / Ollama) has been removed completely: code, scripts, workflow steps, status page and docs. The repo is now Guard only.

---

## Contents

- [What runs where](#what-runs-where)
- [API](#api)
- [Live link via GitHub Pages](#live-link-via-github-pages)
- [Run locally](#run-locally)
- [Run on GitHub Actions](#run-on-github-actions)
- [Configuration](#configuration)
- [Decision logic](#decision-logic)
- [Fingilish detection](#fingilish-detection)
- [Repository structure](#repository-structure)
- [Tests](#tests)

---

## What runs where

| URL (on the service) | What |
|---|---|
| `/` | Guard web panel (`app/static`) |
| `/api/v1/*` | Public JSON API (22 endpoints) |
| `/docs`, `/redoc`, `/openapi.json` | Interactive OpenAPI docs |
| `/api-docs` | Persian API guide (same page as Pages `/api/`, served from `pages/`) |
| `/api/check`, `/health` | Legacy endpoints (kept for the panel and old integrations) |
| `/site/*` | The public site, served by the service too |
| `/chat` | Redirects to `/site/chat/` (the site's chat page) |
| any unknown path | Browsers get the styled 404 page, API clients get JSON |

The service listens on port `8000` and is published through a Cloudflare Quick Tunnel. Every run gets a fresh `trycloudflare.com` link that is published to GitHub Pages automatically.

## API

Base URL = the current tunnel link (find it in `https://<user>.github.io/<repo>/api/links.json`). All responses are JSON. CORS is open, so browsers on any domain can call it.

### Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/api/v1` | Index of every endpoint with full URLs |
| GET | `/api/v1/health` | Status, loaded models, uptime, load |
| GET | `/api/v1/ready` | `200` when ready, `503` while models load |
| GET | `/api/v1/info` | Version, languages, limits, auth |
| GET | `/api/v1/models` | All 5 models (language, weight, loaded) |
| GET | `/api/v1/models/{id}` | One model |
| GET | `/api/v1/config` | Thresholds + decision table |
| GET | `/api/v1/stats` | Counters since start (decisions, latency, cache) |
| GET | `/api/v1/check?text=…` | Quick check via query string |
| POST | `/api/v1/check` | **Full verdict for one text** |
| POST | `/api/v1/check/batch` | Up to 32 texts + summary |
| POST | `/api/v1/verdict` | Minimal: `decision`, `flagged`, `confidence` |
| POST | `/api/v1/score` | Raw per-model scores (optional model subset / forced script) |
| POST | `/api/v1/sentences` | Verdict per sentence with positions |
| POST | `/api/v1/censor` | Mask insults (`words`) or toxic sentences (`sentences`) |
| POST | `/api/v1/moderations` | OpenAI `/v1/moderations`-compatible response |
| POST | `/api/v1/profanity` | Dictionary insults with positions (no models, instant) |
| POST | `/api/v1/language` | Script detection + Fingilish |
| POST | `/api/v1/fingilish/detect` | Is this Latin text Fingilish? |
| POST | `/api/v1/fingilish/transliterate` | Fingilish to Persian script |
| POST | `/api/v1/normalize` | De-obfuscate (`k1r`, `k.i.r`, `kiiiir` to `kir`) |
| POST | `/api/v1/cache/clear` | Admin: empty verdict cache (needs `GUARD_ADMIN_KEY`) |

### Example

```bash
BASE=$(curl -s https://<user>.github.io/<repo>/api/links.txt)
curl -X POST "$BASE/api/v1/check" -H "Content-Type: application/json" -d '{"text":"to khar hasti"}'
```

```json
{
  "id": "chk_8f2c1a9b0d3e4f51",
  "decision": "TOXIC",
  "is_toxic": true,
  "flagged": true,
  "severity": 2,
  "confidence": 0.9105,
  "votes_count": 3,
  "total_models": 4,
  "reason": "3 of 4 models voted toxic (threshold 0.50).",
  "raw_scores": {"persian": 0.962, "textdetox_lg": 0.859, "textdetox_sm": 0.711, "multilingual": 0.204},
  "fingilish_detected": true,
  "fingilish_text": "تو خر هستی",
  "decided_by": "fingilish",
  "profane_terms": ["خر"],
  "cached": false,
  "latency_ms": 412
}
```

`POST /api/v1/check` body: `text` (required), `detailed` (default `true`; `false` drops per-model data), `use_cache` (default `true`).

### Errors

Always the same shape with a real HTTP status:

```json
{"error": {"code": "text_too_long", "message": "'text' has 25000 characters; max is 20000.", "status": 413}}
```

`400 empty_text / unknown_model / bad_mode` · `401 unauthorized` · `404 not_found` · `413 text_too_long / batch_too_large` · `422 invalid_body` · `429 rate_limited` (+ `Retry-After`) · `503 not_ready`.

The legacy `POST /api/check` keeps its old behaviour (HTTP 200 with `{"error": "..."}`) so the web panel and old clients don't break.

### Auth & limits

- Open by default. Set `GUARD_API_KEYS="key1,key2"` to require a key on every `POST /api/v1/*` (send `X-API-Key: key` or `Authorization: Bearer key`). Discovery endpoints stay open.
- Rate limit: `GUARD_RATE_LIMIT` POSTs per minute per IP (default `120`, `0` = off). Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- Every response carries `X-Request-ID` and `X-Process-Time`.
- Identical texts are answered from an in-memory LRU cache (`GUARD_CACHE_SIZE`, default 1024). Nothing is written to disk.

### Clients

No Python package to install: plain `requests` is enough.

```python
import requests

BASE = requests.get("https://<user>.github.io/<repo>/api/links.json", timeout=10).json()["base_url"]
HEADERS = {}   # {"X-API-Key": "..."} if the server sets GUARD_API_KEYS

def guard(path, **body):
    r = requests.post(f"{BASE}/api/v1/{path}", json=body, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.json()

guard("check", text="to khar hasti")["decision"]      # "TOXIC"
guard("verdict", text="Have a nice day")["flagged"]   # False
guard("censor", text="you are a k1r")["text"]         # "you are a ***"
```

```js
import { Guard } from "./clients/js/unicollect-guard.js";   // browser + Node 18+
const g = await Guard.fromStatusPage("https://<user>.github.io/<repo>/");
const { decision } = await g.check("to khar hasti");
```

`clients/curl-examples.sh <base_url> [api_key]` calls every endpoint.

## Live link via GitHub Pages

Every run publishes to the `gh-pages` branch:

| File | Use |
|---|---|
| `index.html`, `chat/`, `api/`, `how-it-works/`, `about/`, `privacy/` | The public site (responsive, light/dark, floating header/footer) |
| `api/links.json` | **Machine-readable live links**: `base_url`, panel, API, Swagger, ReDoc, OpenAPI, health, and every endpoint URL |
| `api/links.txt` | Just the base URL (or `offline`) for shell scripts |
| `assets/status.json` | Status for the site (also used by the secret `muvixo` dialog) |
| `404.html` | Styled not-found page with its asset base pinned to the site root |

The site uses the same colour theme as the chat panel (monochrome, plum accent, dark by default unless the OS asks for light; the choice is shared with the panel). All icons are inline SVG, no emoji.

- **Chat** (`/chat/`): the complete chat panel, talking to the live service found in `api/links.json`. `?text=…` starts a check right away; `?api=https://…` pins a custom server.
- **Home**: the stamp desk plays examples, and the input under it runs a **real check** on the live service (5 model bars + verdict stamp).
- **API page** (`/api/`): live links with copy/open buttons, docs for every endpoint with curl / JavaScript / Python (`requests`) examples, **endpoint search** (press `/`), and a console that sends real requests, shows `X-Request-ID` / rate-limit headers and can **copy the request as curl**.
- **404 page** (`404.html`): GitHub Pages serves it for any missing path, so its `<base>` is pinned to the site root (written by `publish_status.sh`, override with `PAGES_BASE`) and CSS/JS no longer 404 on nested URLs. It suggests the page you probably meant, and points `/api/v1/...` paths at the live service.
- Typing `muvixo` on any page still opens the quick-access dialog.

**One-time setup:**
1. Run the workflow once so the `gh-pages` branch exists.
2. **Settings → Pages**: Source = `Deploy from a branch`, Branch = `gh-pages` / `(root)`.
3. If pushing to `gh-pages` returns 403: **Settings → Actions → General → Workflow permissions** = `Read and write`.

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
python scripts/download_models.py
./scripts/start_server.sh          # http://localhost:8000
python scripts/smoke_test.py       # checks /api/check + every /api/v1 endpoint
```

**Demo mode** (no torch, no models, starts instantly; for UI / API / docs work):

```bash
pip install fastapi "uvicorn[standard]"
GUARD_DEMO_MODE=1 uvicorn app.main:app --reload
```

A small dictionary scorer replaces the 5 checkpoints, and `/health` reports `"mode": "demo"`. Never use it in production.

## Run on GitHub Actions

1. Push to `main`.
2. **Actions** → `Unicollect Ensemble Web + Cloudflare Tunnel` → **Run workflow**.
3. Get the link from the Pages site (`/api/`), `api/links.json`, or the run **Summary** (it lists panel, API, Swagger, ReDoc and the guide).

The service lives about 5 hours per run; `heartbeat.yml` starts the next run. If the tunnel drops, it's restarted and the new link is republished automatically.

Optional repo secrets: `GUARD_API_KEYS`, `GUARD_ADMIN_KEY`.

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `MODELS_ROOT` | `./models` | Where the 5 checkpoints live |
| `GUARD_DEMO_MODE` | off | Run without torch/models |
| `GUARD_API_KEYS` | empty | Comma-separated keys; empty = open API |
| `GUARD_ADMIN_KEY` | empty | Enables `/api/v1/cache/clear` |
| `GUARD_RATE_LIMIT` | `120` | POSTs per minute per IP, `0` = off |
| `GUARD_CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `GUARD_MAX_TEXT_LENGTH` | `20000` | Characters per text |
| `GUARD_MAX_BATCH` | `32` | Texts per batch / moderation call |
| `GUARD_MAX_SENTENCES` | `40` | Sentences for `/sentences` and `/censor` |
| `GUARD_CACHE_SIZE` | `1024` | Verdict cache entries, `0` = off |
| `MODEL_LOAD_WORKERS` | `1` | Parallel model loading |
| `WORKERS` / `PORT` | `2` / `8000` | Gunicorn |

## Decision logic

| Condition | Result |
|---|---|
| 2 or more models vote toxic (score ≥ 0.50) | `TOXIC` |
| …but all voters are one family (TextDetox) and the language specialist scores < 0.15 | needs 3 votes |
| Exactly one vote ≥ 0.90 **and** a second model ≥ 0.30 | `TOXIC` |
| Exactly one vote ≥ 0.90, second model between 0.10 and 0.30 | `SUSPECT` |
| Exactly one vote ≥ 0.90, every other model < 0.10 | `SAFE` (miscalibrated outlier) |
| A vote and highest score ≥ 0.60 | `SUSPECT` |
| Otherwise | `SAFE` |

Persian-only models never run on English text and vice versa. For Fingilish, the Persian-rendered text is checked too (a lone model needs 0.95 there) and the worse verdict wins. `GET /api/v1/config` returns all of this live.

## Fingilish detection

1. **Normalization:** `k1r`, `k!r`, `k.i.r`, `k i r`, `kiiiir` all become `kir`.
2. **Dictionary:** insults and common words (`PROFANE`, `FUNCTION` in `app/fingilish.py`) mapped to Persian; clitics (`kiram` → کیرم) and doubled letters handled.
3. **Letter-by-letter fallback** for unknown words.
4. English words are dropped from the Persian rendering.

Plain English is never transliterated. Context-dependent words (`khar`, `sag`, `pedar`, …) count for detection but `/censor` only masks them with `include_contextual: true`.

To add a word: `_p('persian', 'variant1', ...)` for insults, `_f(...)` for normal words; misdetected English words go into `ENGLISH_WORDS`.

## Repository structure

```
.github/workflows/deploy.yml     Actions: tests, models, server, tunnel, publish link
.github/workflows/heartbeat.yml  Starts the next deploy run
app/engine.py                    Model loading, scoring, ensemble, cache, demo mode
app/api_v1.py                    Public API v1 (22 endpoints)
app/main.py                      FastAPI app: middleware, errors, legacy endpoints, static
app/consensus.py                 Voting logic (no torch, unit-tested)
app/fingilish.py                 Fingilish detection, transliteration, insult finder/masker
app/static/                      Guard web panel
pages/                           Public site + chat + API docs + 404 (GitHub Pages and /site on the service)
pages/api/links.json             Placeholder, overwritten with the live link on gh-pages
clients/js/                      JS client (browser + Node)
clients/curl-examples.sh         Every endpoint with curl
scripts/publish_status.sh        Publishes site + links.json + links.txt to gh-pages
scripts/sync_chat.py             Copies the chat panel (app/static) into pages/chat + pages/assets/chat.*
scripts/download_models.py       Downloads the 5 models
scripts/start_server.sh          Gunicorn (preload, 2 workers)
scripts/smoke_test.py            Smoke test for a running server (all endpoints)
tests/                           Unit + API tests
```

## Tests

```bash
pip install -r requirements-dev.txt
GUARD_DEMO_MODE=1 pytest
```

`tests/test_consensus.py` and `tests/test_fingilish.py` cover the voting and Fingilish logic; `tests/test_api.py` exercises every API endpoint, error shapes, API keys and CORS in demo mode; `tests/test_pages.py` checks the site (chat in sync, header/footer on every page, links resolve, docs accordion ids).

Editing the chat UI: change `app/static/*`, then run `python scripts/sync_chat.py`.
