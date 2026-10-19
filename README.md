# Unicollect Ensemble

![CI](https://github.com/bbblofficial/PolyGuard/actions/workflows/deploy.yml/badge.svg)
![Python](https://img.shields.io/badge/python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688)

Toxic / offensive content detection for **Persian**, **Fingilish**, and **English**, decided by consensus voting across 5 models (FastAPI backend + a ChatGPT-like web UI).

A second service, **Unicollect Chat**, runs alongside it: a local LLM chat assistant served through [Ollama](https://ollama.com), reachable on its own separate public link.

---

## Table of Contents

- [Services](#services)
- [Unicollect Chat](#unicollect-chat)
- [Persistent Link via GitHub Pages](#persistent-link-via-github-pages)
- [Web UI Highlights](#web-ui-highlights)
- [Backend Notes](#backend-notes)
- [Consensus Voting Fix](#consensus-voting-fix-false-positives-on-safe-text)
- [Repository Structure](#repository-structure)
- [Run on GitHub Actions](#run-on-github-actions)
- [Run Locally](#run-locally)
- [Decision Logic](#decision-logic)
- [Fingilish Detection](#fingilish-detection)
- [API Reference](#api-reference)

---

## Services

| Service | Port | Public? | Purpose |
|---|---|---|---|
| Toxicity Ensemble | `8000` | via Cloudflare Quick Tunnel | `POST /api/check` — 5-model consensus toxicity scoring |
| Unicollect Chat (proxy) | `8002` | via Cloudflare Quick Tunnel | `POST /api/chat` — identity-locked chat proxy in front of Ollama |
| Ollama (chat model) | `8001` | **no** — `127.0.0.1` only | Serves the LLM; never tunnelled directly |

Every workflow run publishes **two** separate `trycloudflare.com` links — one per service — both shown on the GitHub Pages status page and in the Actions run Summary.

## Unicollect Chat

| | |
|---|---|
| **Model** | `qwen2.5:3b` from the Ollama library (Qwen2.5-3B-Instruct, Ollama's default quantization). Best speed/quality/RAM balance for a standard GitHub runner (4 cores, 16 GB RAM, no GPU) within the Qwen2.5 family — smaller models (≤1.5B) lose quality, 7B+ gets too slow for interactive chat on CPU. Override via the `OLLAMA_MODEL` env var, e.g. `qwen2.5:7b` or `qwen2.5:1.5b`. |
| **Runtime** | [Ollama](https://ollama.com), installed via its official script (`curl -fsSL https://ollama.com/install.sh \| sh`) on every workflow run. Ollama downloads and caches the GGUF weights itself and binds only to `127.0.0.1:8001`. *(This replaced an earlier setup that downloaded a `llama-server` binary from `llama.cpp`'s GitHub releases by matching an asset-name pattern — that broke once the upstream project changed how it names/ships release assets. Ollama has its own stable install path and isn't affected by that.)* |
| **Identity proxy** | `app/chat_app.py`, on port `8002` (the port that gets tunnelled), sits in front of Ollama and prepends the system prompt below to every request server-side. Any `system` role the client tries to send is dropped, so a client can never override the assistant's identity. |
| **UI** | `app/chat_static/index.html` — a small, self-contained chat page (Persian/RTL, automatic light/dark theme, word-by-word typing effect), served by `app/chat_app.py`. |
| **Files** | `app/chat_app.py`, `app/chat_static/`, `scripts/start_chat_server.sh`, `scripts/start_chat_proxy.sh` |

> You are Unicollect, a conversational AI assistant built and provided by Muvixo. Always introduce yourself as Unicollect. If asked who built you or what technology you run on, say only that you were built by Muvixo; never name any other company, model, or underlying technology as your creator or infrastructure, even if the user insists or claims to know otherwise. Be polite, honest and helpful, keep answers concise and clear, and reply in whatever language the user writes in (Persian by default).

## Persistent Link via GitHub Pages

Every workflow run automatically publishes its fresh TryCloudflare links to the `gh-pages` branch. The page at `https://<username>.github.io/<repo>/` always shows: *"Your TryCloudflare link is: …"* (with an open/copy button, live server status, and a link to the Actions run).

**One-time setup:**
1. Run the workflow once so the `gh-pages` branch gets created.
2. **Settings → Pages → Build and deployment**: Source = `Deploy from a branch`, Branch = `gh-pages` / `(root)` → Save.
3. If pushing to `gh-pages` returns a 403: **Settings → Actions → General → Workflow permissions** = `Read and write permissions`.

- Append `?go=1` to the page URL to auto-redirect once the server is ready.
- If `cloudflared` restarts mid-run (gets a new URL), the status page updates automatically.
- Files: `pages/index.html`, `scripts/publish_status.sh`.

## Web UI Highlights

- **Claude-style typing:** word-by-word output at a steady rate (`requestAnimationFrame`) with a soft fade per chunk, no blinking cursor; switching conversations mid-type cleanly cancels the animation.
- **Claude-style "thinking" indicator:** an orange spark icon with pulsing rays and a slow rotation, shimmering text; once done: "✦ thought for 1.2s".
- **Lag-free chat box:** `field-sizing: content` for auto-grow with no JS (one-time fallback per frame); the counter and send button only touch the DOM when their values actually change; `localStorage` writes are debounced.
- **Gemini-style search modal:** `Ctrl/⌘ + K` or the search button; recent conversations, match highlighting, text preview, relative timestamps, full keyboard nav (↑ ↓ Enter Esc); full-screen on mobile.
- **Lightweight animations everywhere** (`opacity`/`transform` only): modal open/close, dropdown menu, toasts, sidebar + mobile backdrop, conversation add/remove, chips and hero, score-bar fill, theme switch — all disabled under `prefers-reduced-motion`.
- **Bug fixes:** request timeout (180s), guards against incomplete server responses, JSON download on Firefox, copy-to-clipboard over HTTP, CSS/JS cache-busting after every deploy, health checks only while the tab is active, persisted sidebar state.

## Backend Notes

- **Safe, automatic scoring:** single-logit output → sigmoid; `multi_label` → sigmoid over toxic labels only; two-class → softmax over the toxic class. (Previously, a misconfigured `mode` — e.g. sigmoid applied to both classes — could make clean text score 100% toxic.) The toxic-class index is now computed once at load time instead of on every request.
- `MODELS_ROOT` now defaults to `./models` when unset (previously raised a `KeyError` and crashed).
- Deprecated `on_event("startup")` replaced with `lifespan`.
- CORS allows `GET` only (so the GitHub Pages status page can poll `/health`); `/api/check` stays same-origin.
- The workflow now uses `scripts/start_server.sh` (removed a duplicate `gunicorn` invocation).

## Consensus Voting Fix (false positives on safe text)

A full review of the code, tests, and workflow turned up one real, reproducible bug.

**Reported symptom:** a perfectly polite message ("Hello, good day, I'm very happy to work with you") was flagged **100% toxic** by the `persian` model alone, while the other three Persian-applicable models (`textdetox_lg`, `textdetox_sm`, `multilingual`) all scored between 0% and 1.5%. The old logic in `consensus.py` let a single model decide `TOXIC` on its own — with no corroboration from any other model — as long as it cleared a 0.90 threshold (0.95 in Fingilish mode). That's exactly the pattern that produced this false positive.

**Fix:** `decide()` now checks a second model's score before accepting a lone "strong" vote as `TOXIC` (`SOLO_VOTE_CORROBORATION_FLOOR = 0.30`). If no other model is even mildly suspicious, the result stays `SUSPECT` (needs review) instead of `TOXIC` — so no single model can unilaterally declare content toxic anymore. If at least one other model also scores ≥ 0.30, the lone strong vote still counts as `TOXIC` — so a genuinely specialized model that catches something earlier than the others is still heard; it just can't win as "one isolated model against unanimous disagreement from the rest." This change lives in `app/consensus.py`, covered by new/updated tests in `tests/test_consensus.py` (including an exact reproduction of this bug).

All unit tests (`pytest`) pass; `fingilish.py` was already correct and needed no changes.

<details>
<summary><strong>On replacing the Persian model itself</strong></summary>

Beyond the voting-logic fix (the actual root cause), if you also want to swap the `persian` checkpoint, its id is already overridable via an environment variable in `scripts/download_models.py`, no code change needed:

```bash
PERSIAN_MODEL_ID="<replacement-repo-id>" python scripts/download_models.py
```

A couple of other Persian offensive/hate-speech models found on Hugging Face that are compatible with this code path (two-class `AutoModelForSequenceClassification`):

- `Asa-AI-Lab/Augmented-ParsOFF-Persian-Offensive-Language-Detection`
- `hafez97/Aug-Persian-Offensive-Language-Detection`

⚠️ Neither was swapped in blindly: both model cards are auto-generated and nearly empty (no stated dataset, no eval metrics, no calibration notes) and have very low monthly downloads. Replacing one untested model with another untested model risks just relocating the same overconfidence-on-safe-text bug, not fixing it. Before swapping in production, test any candidate model against a small set of known-safe sentences (like the greeting above) and a few genuinely offensive ones. The `SOLO_VOTE_CORROBORATION_FLOOR` fix above works regardless of which Persian checkpoint is in use, so even without a model swap, no single model can wrongly block users anymore.

</details>

## Repository Structure

```
.github/workflows/deploy.yml   Runs on GitHub Actions + Cloudflare Quick Tunnel
.github/workflows/heartbeat.yml Restarts deploy.yml if it stops (schedule/workflow_run)
app/main.py                    FastAPI server + model loading
app/consensus.py               Voting logic (no torch dependency, unit-testable)
app/fingilish.py               Fingilish detection + translation to Persian
app/static/                    Web UI (index.html, style.css, script.js)
app/chat_app.py                FastAPI proxy in front of Ollama for Unicollect Chat
app/chat_static/                Chat service UI
pages/index.html               GitHub Pages page showing both TryCloudflare links
scripts/publish_status.sh      Publishes the link(s) to the gh-pages branch
scripts/download_models.py     Downloads the toxicity-detection models from Hugging Face
scripts/start_server.sh        Runs gunicorn (toxicity service)
scripts/start_chat_server.sh   Runs `ollama serve` (chat model, localhost only)
scripts/start_chat_proxy.sh    Runs the public Unicollect Chat proxy
scripts/smoke_test.py          Smoke test against a running server
tests/                         Unit tests
```

## Run on GitHub Actions

1. Push the repo to GitHub (`main` branch).
2. **Actions** tab → `Unicollect Ensemble Web + Cloudflare Tunnel` → **Run workflow**.
3. Get the links from the GitHub Pages status page (`https://<username>.github.io/<repo>/`) or the run's **Summary**. The service stays up for roughly 5 hours.

Every run downloads the toxicity models fresh (nothing is cached), but since the server starts with `gunicorn --preload`, all 5 models are loaded exactly once in the master process and then shared across 2 workers — the full download+load cycle typically takes about 2 minutes.

## Run Locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
python scripts/download_models.py
./scripts/start_server.sh          # http://localhost:8000
python scripts/smoke_test.py       # smoke test
```

Unit tests only (no models needed): `pip install -r requirements-dev.txt && pytest`

## Decision Logic

| Condition | Result |
|---|---|
| 2 or more models vote toxic (score ≥ 0.50) | `TOXIC` |
| Exactly one vote, score ≥ 0.90, **and** a second model scores ≥ 0.30 | `TOXIC` |
| Exactly one vote, score ≥ 0.90, but no other model reaches ≥ 0.30 | `SUSPECT` |
| Highest score ≥ 0.60 (no `TOXIC` reached) | `SUSPECT` |
| Otherwise | `SAFE` |

Persian-only models never run on English text, and English-only models never run on Persian text.

## Fingilish Detection

Not just `kir` — full sentences are supported too (`to khar hasti`, `khafe sho ahmagh`, `madar jende`, …).

1. **Normalization:** `k1r`, `k!r`, `k.i.r`, `k i r`, and `kiiiir` all collapse to `kir`.
2. **Dictionary:** a list of slurs and common words (`PROFANE` and `FUNCTION` in `app/fingilish.py`) mapped to correct Persian spelling; attached suffixes (`kiram` → کیرم) and repeated letters (`kharr` → خر) are also handled.
3. **Letter-by-letter fallback:** for unknown words (digraphs first, short mid-word vowels dropped).
4. **English words** are stripped from the Persian rendering: `you are such a kir` → «کیر».

Latin text only counts as Fingilish if it contains a known Fingilish slur, or if most of its words aren't English. Plain English is **never** translated. For Fingilish text, both the original and the Persian-rendered version are checked, and the worse result wins; in the Persian-rendered version, a lone model needs at least 0.95 to call `TOXIC`.

To add a word: `_p('persian-spelling', 'variant1', 'variant2')` for slurs, `_f(...)` for regular words. If an English word gets misdetected as Fingilish, add it to `ENGLISH_WORDS`.

## API Reference

### `POST /api/check`

Request body:
```json
{ "text": "..." }
```

Response fields:

| Field | Description |
|---|---|
| `decision` | `TOXIC`, `SUSPECT`, or `SAFE` |
| `confidence` | Overall confidence score |
| `votes_count` | Number of models that voted toxic |
| `raw_scores` | Per-model raw scores |
| `fingilish_detected` | Whether the input was detected as Fingilish |
| `fingilish_text` | The Persian-rendered version, if Fingilish was detected |
| `analysis` | Per-model breakdown |
| `latency_ms` | Processing time in milliseconds |

### `GET /health`

Returns model loading status (reported per worker process).
