# Unicollect

![CI](https://github.com/bbblofficial/PolyGuard/actions/workflows/deploy.yml/badge.svg)
![Python](https://img.shields.io/badge/python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688)

Text-safety API for **Persian**, **Fingilish** and **English**. Five classifiers score every text and a consensus vote returns `SAFE`, `SUSPECT` or `TOXIC`. Built and maintained by Muvixo.

The project has three parts:

| Part | Where | What |
|---|---|---|
| API + panel | `app/` | FastAPI service on port `8000`, text-check panel at `/`, Swagger at `/docs`, ReDoc at `/redoc` |
| Public site | `pages/` | Persian (RTL, Vazirmatn) site published to GitHub Pages: home, full API docs with a live playground, how it works, about, privacy |
| Deploy | `.github/workflows/` | Runs the API on GitHub Actions behind a Cloudflare Quick Tunnel and publishes the live link to the site |

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health`, `/api/v1/health` | readiness and loaded models |
| GET | `/api/v1/info` | name, version, limits, endpoint list |
| GET | `/api/v1/models` | the five classifiers, weights, load state |
| GET | `/api/v1/thresholds` | consensus voting thresholds |
| GET | `/api/v1/stats` | uptime, request and decision counters |
| POST | `/api/v1/check` | analyse one text (`{"text": "...", "detailed": true}`) |
| POST | `/api/v1/check/batch` | analyse up to 32 texts (`{"texts": [...], "detailed": false}`) |
| POST | `/api/v1/detect` | script and Fingilish detection, no models needed |
| POST | `/api/v1/fingilish` | transliterate Fingilish to Persian |
| POST | `/api/check` | legacy single check, errors returned as `200 {"error": "..."}` |

v1 errors use real HTTP codes and `{"error": {"code": "...", "message": "..."}}`: `400 empty_text|empty_batch`, `413 text_too_long|batch_too_large`, `422` invalid JSON, `503 models_loading|no_models_applicable`, `500 internal_error`. Limits: 20,000 characters per text, 32 texts per batch.

```bash
curl -X POST "$UNICOLLECT_URL/api/v1/check" \
  -H "Content-Type: application/json" \
  -d '{"text":"سلام، روز خوبی داشته باشی"}'
```

Full Persian documentation with examples in cURL, JavaScript and Python lives at `pages/api-docs/`.

CORS allows `GET` and `POST` from any origin so the site's playground can call the API. Restrict it with `CORS_ALLOW_ORIGINS="https://you.github.io"`.

## Design system

Both the panel and the site share `tokens.css` (`app/static/tokens.css` = `pages/assets/tokens.css`): purple accent, light by default, dark from the OS or the visitor's choice (`html[data-theme]`, stored as `unicollect_theme`). Fonts: Vazirmatn (jsDelivr with Google Fonts fallback, loaded non-blocking) and JetBrains Mono for code. Typing `muvixo` on any site page opens the live-links dialog.

## Decision logic

A model votes when its score is `>= 0.50`. Two votes give `TOXIC`, unless both come from the same model family and the language specialist is confident the text is clean, in which case a third vote is required. A lone vote `>= 0.90` (`0.95` for Fingilish) is `TOXIC` only if another model scores `>= 0.30`, otherwise `SUSPECT` (second score `>= 0.10`) or `SAFE`. A single vote with max score `>= 0.60` is `SUSPECT`. Fingilish text is transliterated and analysed again in strict mode; the worse result wins. See `app/consensus.py`.

## Run on GitHub Actions

1. Push to `main`. The `deploy.yml` workflow downloads the models, starts the API, opens a tunnel and publishes the link to `gh-pages`.
2. One-time: **Settings → Pages** → branch `gh-pages` / root. If the push gets a 403: **Settings → Actions → General → Workflow permissions** = read and write.
3. `heartbeat.yml` restarts the deploy before the six-hour job limit (needs a `PAT_TOKEN` secret).

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
python scripts/download_models.py
./scripts/start_server.sh          # http://localhost:8000
python scripts/smoke_test.py       # checks every endpoint
```

Unit tests (no models needed): `pip install -r requirements-dev.txt && pytest`

Preview the site: `cd pages && python -m http.server` and open http://localhost:8000.

## Repository structure

```
app/main.py                 FastAPI app, model loading, every endpoint
app/consensus.py            voting logic (pure, unit-tested)
app/fingilish.py            Fingilish detection and transliteration
app/static/                 text-check panel (index.html, tokens.css, style.css, script.js)
pages/                      public site (index, api-docs, how-it-works, about, privacy, 404)
pages/assets/               tokens.css, site.css, site.js, favicon.svg, status.json
scripts/download_models.py  downloads the five classifiers
scripts/start_server.sh     gunicorn launcher
scripts/publish_status.sh   publishes pages/ + live link to gh-pages
scripts/smoke_test.py       end-to-end checks against a running server
tests/                      unit tests
```
