import os

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

import hashlib
import time
import traceback
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict

import torch
torch.set_num_threads(1)

from anyio import to_thread
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from app.fingilish import fingilish_to_persian, looks_like_fingilish
from app.consensus import (
    PER_MODEL_VOTE_THRESHOLD, MIN_VOTES_FOR_TOXIC, SEVERITY,
    detect_script, decide, worst,
)

# ------------------------------------------------------------------
# Concurrency control
# ------------------------------------------------------------------
CPU_COUNT = os.cpu_count() or 4
MAX_CONCURRENT_INFERENCES = max(2, CPU_COUNT)
MAX_THREADPOOL_TOKENS = 200

_infer_sem = threading.Semaphore(MAX_CONCURRENT_INFERENCES)
_counter_lock = threading.Lock()

BASE_DIR = Path(__file__).resolve().parent
# Default to <repo>/models so a plain `uvicorn app.main:app` works locally
# without exporting MODELS_ROOT first (it used to crash with KeyError).
MODELS_ROOT = Path(os.environ.get("MODELS_ROOT") or (BASE_DIR.parent / "models"))


# Hard cap on request size. The tokenizer truncates to 512 tokens anyway, so
# anything beyond a few thousand characters adds no signal - it only lets a
# client tie up a worker thread tokenizing a huge string. Keep this generous
# enough for real use (long posts, multi-paragraph messages) while blocking
# pathological payloads.
MAX_TEXT_LENGTH = 20_000


class TextIn(BaseModel):
    text: str   # length is enforced in the handler (see MAX_TEXT_LENGTH)


state = {"models": {}, "errors": {}, "ready": False, "inflight": 0, "peak": 0}

MODEL_SPECS = {
    # The Persian checkpoint is a multi-label classifier
    # (config.problem_type == "multi_label_classification") with a single
    # output logit. It must be scored with sigmoid, NOT softmax: applying
    # softmax to a single logit always returns 1.0, which is exactly the
    # "everything is 100% toxic" bug.
    "persian":      {"dir": MODELS_ROOT / "persian",           "mode": "multilabel", "weight": 2.0, "lang": "fa",    "label": "Unicollect فارسی", "label_en": "Unicollect Persian"},
    "textdetox_lg": {"dir": MODELS_ROOT / "textdetox_large",   "mode": "binary",     "weight": 2.0, "lang": "multi", "label": "Unicollect چندزبانه پرو",     "label_en": "Unicollect Multilingual Pro"},
    "textdetox_sm": {"dir": MODELS_ROOT / "textdetox_base",    "mode": "binary",     "weight": 1.5, "lang": "multi", "label": "Unicollect چندزبانه سریع",        "label_en": "Unicollect Multilingual Swift"},
    "multilingual": {"dir": MODELS_ROOT / "multilingual",      "mode": "multilabel", "weight": 1.0, "lang": "multi", "label": "Unicollect چندزبانه گسترده",       "label_en": "Unicollect Multilingual Broad"},
    "twitter_off":  {"dir": MODELS_ROOT / "twitter_offensive", "mode": "binary",     "weight": 1.0, "lang": "en",    "label": "Unicollect انگلیسی", "label_en": "Unicollect English"},
}

# ------------------------------------------------------------------
# Which output index is the "toxic/offensive" class?
# ------------------------------------------------------------------
_TOXIC_KEYWORDS = ("toxic", "offens", "hate", "abuse", "insult",
                   "profan", "vulgar", "obscen", "hateful", "harass")
_SAFE_KEYWORDS = ("non", "not", "clean", "safe", "normal", "neutral",
                  "ok", "benign", "harmless")


def _resolve_toxic_index(model) -> int:
    """Return the output index whose class is the toxic/offensive one.

    Reads model.config.id2label when available instead of hardcoding index 1,
    because some checkpoints (notably the Persian offensive BERT) put the
    offensive class at index 0.
    """
    cfg = getattr(model, "config", None)
    id2label = getattr(cfg, "id2label", None) or {}

    # Normalize keys to int
    try:
        labels = {int(k): str(v) for k, v in id2label.items()}
    except (TypeError, ValueError):
        labels = {}

    if not labels:
        return 1  # legacy default

    # 1) a label that names the toxic class directly
    for idx, name in labels.items():
        n = name.lower()
        if any(k in n for k in _TOXIC_KEYWORDS) and \
           not any(s in n for s in _SAFE_KEYWORDS):
            return idx

    # 2) a label that names the safe class -> toxic is the other one
    for idx, name in labels.items():
        n = name.lower()
        if any(k in n for k in _SAFE_KEYWORDS):
            other = 1 - idx
            if other in labels:
                return other

    # 3) can't tell -> keep old behavior
    return 1


def _resolve_scoring(model, spec_mode: str):
    """Pick the scoring strategy from the checkpoint itself, once, at load time.

    The configured `mode` is only a hint. Getting this wrong silently breaks a
    model, e.g. sigmoid-max over a 2-class softmax head (scores the *safe*
    logit too, so clean text looks toxic) or softmax over a single logit
    (always 1.0). Returns (strategy, index_or_indices).
    """
    cfg = getattr(model, "config", None)
    n = int(getattr(cfg, "num_labels", 0) or 0)
    problem_type = getattr(cfg, "problem_type", None)

    if n == 1:
        return "sigmoid1", 0
    if problem_type == "multi_label_classification" or (spec_mode == "multilabel" and n > 2):
        id2label = getattr(cfg, "id2label", None) or {}
        try:
            labels = {int(k): str(v).lower() for k, v in id2label.items()}
        except (TypeError, ValueError):
            labels = {}
        idx = [i for i, name in labels.items()
               if not any(sk in name for sk in _SAFE_KEYWORDS)]
        return "sigmoid_max", (idx or list(range(n)))
    return "softmax", _resolve_toxic_index(model)


# ------------------------------------------------------------------
# Model loading - at import time, so it works with gunicorn --preload
# ------------------------------------------------------------------
def _load_one(name, spec):
    try:
        print(f"[Ensemble] Loading '{name}'...", flush=True)
        tok = AutoTokenizer.from_pretrained(str(spec["dir"]), local_files_only=True)
        mdl = AutoModelForSequenceClassification.from_pretrained(
            str(spec["dir"]), local_files_only=True
        )
        mdl.eval()

        # --- DEBUG: show the model's real label mapping -------------
        id2label = getattr(mdl.config, "id2label", {}) or {}
        problem_type = getattr(mdl.config, "problem_type", None)
        print(f"[Ensemble] '{name}' id2label={id2label} "
              f"problem_type={problem_type} mode={spec['mode']}", flush=True)
        scoring = _resolve_scoring(mdl, spec["mode"])
        print(f"[Ensemble] '{name}' -> scoring={scoring[0]} index={scoring[1]}",
              flush=True)
        # ------------------------------------------------------------

        state["models"][name] = (
            mdl, tok, scoring, spec["weight"],
            spec["lang"], spec["label"], spec["label_en"],
        )
        print(f"[Ensemble] OK '{name}' loaded", flush=True)
    except Exception as exc:
        state["errors"][name] = str(exc)
        print(f"[Ensemble] FAILED '{name}': {exc}", flush=True)


def _bootstrap():
    print("[Ensemble] Bootstrap starting...", flush=True)
    # These checkpoints use roughly 6-8 GB on disk combined and need
    # substantially more RAM while deserializing. Serial loading avoids
    # swapping/OOM on the standard GitHub runner. Set MODEL_LOAD_WORKERS=2
    # only on a larger host.
    workers = max(1, min(int(os.environ.get("MODEL_LOAD_WORKERS", "1")),
                         len(MODEL_SPECS)))
    print(f"[Ensemble] Loading {len(MODEL_SPECS)} models with "
          f"{workers} concurrent loaders...", flush=True)
    with ThreadPoolExecutor(max_workers=workers,
                            thread_name_prefix="model-loader") as pool:
        futures = {
            pool.submit(_load_one, name, spec): name
            for name, spec in MODEL_SPECS.items()
        }
        for future in as_completed(futures):
            # _load_one logs and records its own errors. Re-raise unexpected
            # loader failures so they are visible in server.log.
            future.result()
    state["ready"] = True
    print(f"[Ensemble] Ready. Loaded: {list(state['models'].keys())} "
          f"Errors: {list(state['errors'].keys())}", flush=True)


_bootstrap()


# ------------------------------------------------------------------
# Scoring
# ------------------------------------------------------------------
def _score(model, tokenizer, text, scoring):
    """Toxic probability for one model, using the strategy resolved at load."""
    strategy, idx = scoring
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.inference_mode():
        logits = model(**inputs).logits.squeeze(0)
    if strategy == "sigmoid1":
        return float(torch.sigmoid(logits.reshape(-1)[0]).item())
    if strategy == "sigmoid_max":
        return float(torch.sigmoid(logits[idx]).max().item())
    return float(torch.softmax(logits, dim=-1)[idx].item())


# ------------------------------------------------------------------
# Ensemble voting - pure function, returns a fresh dict
# ------------------------------------------------------------------
def _run_ensemble(text: str, script: str, strict: bool = False) -> Dict:
    models_snapshot = list(state["models"].items())

    raw, weighted, weights, labels, labels_en, skipped = {}, {}, {}, {}, {}, []
    for name, (mdl, tok, scoring, weight, lang, label, label_en) in models_snapshot:
        if script == "fa" and lang == "en":
            skipped.append(name)
            continue
        if script == "en" and lang == "fa":
            skipped.append(name)
            continue

        try:
            s = _score(mdl, tok, text, scoring)
        except Exception as exc:
            print(f"[Ensemble] inference error in {name}: {exc}", flush=True)
            s = 0.0

        raw[name] = round(s, 4)
        weighted[name] = round(s * weight, 4)
        weights[name] = weight
        labels[name] = label
        labels_en[name] = label_en

    if not raw:
        return {"error": "no models applicable", "details": dict(state["errors"])}

    decision, votes, votes_count, max_raw, confidence = decide(raw, strict=strict, script=script)
    max_weighted = max(weighted.values())

    return {
        "decision": decision,
        "max_weighted": round(max_weighted, 4),
        "max_raw": round(max_raw, 4),
        "confidence": confidence,
        "votes_count": votes_count,
        "votes": votes,
        "raw_scores": raw,
        "weighted_scores": weighted,
        "weights": weights,
        "labels": labels,
        "labels_en": labels_en,
        "total_models": len(raw),
        "skipped_models": skipped,
        "script": script,
        "vote_threshold": PER_MODEL_VOTE_THRESHOLD,
        "min_votes": MIN_VOTES_FOR_TOXIC,
        "errors": dict(state["errors"]),
    }


# ------------------------------------------------------------------
# Dual analysis: original text + (only if it really is Fingilish) the
# transliterated text.  Plain English is NEVER transliterated.
# ------------------------------------------------------------------
def _summary_of(result):
    """Small flat copy - must never contain the parent dict."""
    if not result or "decision" not in result:
        return {"error": result.get("error") if result else "no result"}
    return {
        "decision": result["decision"],
        "confidence": result["confidence"],
        "max_raw": result["max_raw"],
        "votes_count": result["votes_count"],
        "total_models": result["total_models"],
        "script": result["script"],
    }


def ensemble_predict(text: str) -> Dict:
    t0 = time.perf_counter()

    script_original = detect_script(text)

    has_fingilish = False
    persian_text = ""
    if script_original == "en" and looks_like_fingilish(text):
        persian_text = fingilish_to_persian(text)
        has_fingilish = (
            persian_text.strip() != ""
            and detect_script(persian_text) == "fa"
        )

    result_original = _run_ensemble(text, script_original)

    result_fingilish = None
    if has_fingilish:
        result_fingilish = _run_ensemble(persian_text, "fa", strict=True)

    candidates = [r for r in (result_original, result_fingilish) if r and "decision" in r]
    if not candidates:
        return {"error": "no models applicable", "details": dict(state["errors"])}

    final_decision = worst(r["decision"] for r in candidates)
    primary = next((r for r in candidates if r["decision"] == final_decision), candidates[0])

    response = dict(primary)
    response["decision"] = final_decision
    response["fingilish_detected"] = has_fingilish
    response["fingilish_text"] = persian_text if has_fingilish else None
    response["decided_by"] = "fingilish" if (result_fingilish is not None and primary is result_fingilish) else "original"
    response["analysis"] = {
        "original": _summary_of(result_original),
        "fingilish": _summary_of(result_fingilish) if result_fingilish else None,
    }
    response["latency_ms"] = round((time.perf_counter() - t0) * 1000)
    return response


# ------------------------------------------------------------------
# FastAPI
# ------------------------------------------------------------------
@asynccontextmanager
async def _lifespan(_app):
    # (replaces the deprecated @app.on_event("startup"))
    to_thread.current_default_thread_limiter().total_tokens = MAX_THREADPOOL_TOKENS
    print(f"[Ensemble] Worker ready. cpu={CPU_COUNT} "
          f"parallel_inferences={MAX_CONCURRENT_INFERENCES} "
          f"threadpool={MAX_THREADPOOL_TOKENS}", flush=True)
    yield


app = FastAPI(title="Unicollect Ensemble", lifespan=_lifespan)

# The GitHub Pages status page (another origin) pings GET /health to show
# whether the tunnel is live. Only GET is allowed cross-origin; /api/check
# stays same-origin.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"],
                   allow_headers=[])


@app.get("/health")
def health():
    return {
        "status": "ok" if state["ready"] and state["models"] else
                  ("loading" if not state["ready"] else "error"),
        "loaded_models": [MODEL_SPECS[name]["label"] for name in state["models"]],
        "errors": dict(state["errors"]),
        "inflight": state["inflight"],
        "peak": state["peak"],
        "concurrency": MAX_CONCURRENT_INFERENCES,
    }


@app.post("/api/check")
def check(data: TextIn):
    try:
        if not state["ready"] or not state["models"]:
            return {"error": state["errors"] or "no models loaded yet"}

        if len(data.text) > MAX_TEXT_LENGTH:
            return {"error": f"text too long ({len(data.text)} chars, max {MAX_TEXT_LENGTH})"}

        if not data.text.strip():
            # an empty/whitespace-only string used to run all 5 models for nothing
            return {"error": "text is empty"}

        with _infer_sem:
            with _counter_lock:
                state["inflight"] += 1
                if state["inflight"] > state["peak"]:
                    state["peak"] = state["inflight"]
            try:
                return ensemble_predict(data.text)
            finally:
                with _counter_lock:
                    state["inflight"] -= 1
    except Exception as exc:
        print(f"[Ensemble] /api/check EXC:\n{traceback.format_exc()}", flush=True)
        return {"error": f"{type(exc).__name__}: {exc}"}


def _asset_version() -> str:
    h = hashlib.sha1()
    for f in ("style.css", "script.js"):
        try:
            h.update((BASE_DIR / "static" / f).read_bytes())
        except OSError:
            pass
    return h.hexdigest()[:10]


# Cache-bust CSS/JS on every deploy, otherwise browsers (and the Cloudflare
# edge) can keep serving the previous script.js after an update.
_INDEX_HTML = (BASE_DIR / "static" / "index.html").read_text(encoding="utf-8") \
    .replace("__V__", _asset_version())


@app.get("/")
def index():
    return HTMLResponse(_INDEX_HTML, headers={"Cache-Control": "no-cache"})


app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")