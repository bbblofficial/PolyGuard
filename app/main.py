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
from typing import Dict, List, Optional

import torch
torch.set_num_threads(1)

from anyio import to_thread
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from app.fingilish import fingilish_to_persian, looks_like_fingilish
from app import consensus as _consensus
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
APP_NAME = "Unicollect Text Safety API"
APP_VERSION = "2.0.0"
STARTED_AT = time.time()
MAX_BATCH_ITEMS = 32

stats = {
    "requests": 0,
    "checks": 0,
    "batches": 0,
    "errors": 0,
    "decisions": {"SAFE": 0, "SUSPECT": 0, "TOXIC": 0},
}


class CheckIn(BaseModel):
    text: str = Field(..., description="Persian, Fingilish or English text (max 20,000 chars)")
    detailed: bool = Field(True, description="false returns only the compact summary")


class BatchIn(BaseModel):
    texts: List[str] = Field(..., description=f"1 to {MAX_BATCH_ITEMS} texts")
    detailed: bool = Field(False, description="true returns the full result for every item")


@asynccontextmanager
async def _lifespan(_app):
    # (replaces the deprecated @app.on_event("startup"))
    to_thread.current_default_thread_limiter().total_tokens = MAX_THREADPOOL_TOKENS
    print(f"[Ensemble] Worker ready. cpu={CPU_COUNT} "
          f"parallel_inferences={MAX_CONCURRENT_INFERENCES} "
          f"threadpool={MAX_THREADPOOL_TOKENS}", flush=True)
    yield


app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Toxicity and offensive-language detection for Persian, Fingilish and English, "
                "decided by consensus voting across five classifiers.",
    lifespan=_lifespan,
)

# The public site (GitHub Pages, another origin) polls /health and runs the
# API playground, so GET and POST are allowed cross-origin. Restrict with
# CORS_ALLOW_ORIGINS="https://you.github.io,https://example.com".
_origins = [o.strip() for o in os.environ.get("CORS_ALLOW_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_origins or ["*"],
                   allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type"])


def _error(status: int, code: str, message: str, **extra):
    with _counter_lock:
        stats["errors"] += 1
    return JSONResponse(status_code=status,
                        content={"error": {"code": code, "message": message, **extra}})


def _text_problem(text: str, need_models: bool = True) -> Optional[tuple]:
    """(http_status, code, message) when the text can't be analysed, else None."""
    if need_models and (not state["ready"] or not state["models"]):
        return 503, "models_loading", "models are still loading, retry in a few seconds"
    if not isinstance(text, str) or not text.strip():
        return 400, "empty_text", "text is empty"
    if len(text) > MAX_TEXT_LENGTH:
        return 413, "text_too_long", f"text too long ({len(text)} chars, max {MAX_TEXT_LENGTH})"
    return None


def _guarded_predict(text: str) -> Dict:
    with _infer_sem:
        with _counter_lock:
            state["inflight"] += 1
            state["peak"] = max(state["peak"], state["inflight"])
        try:
            result = ensemble_predict(text)
        finally:
            with _counter_lock:
                state["inflight"] -= 1
    with _counter_lock:
        stats["checks"] += 1
        d = result.get("decision")
        if d in stats["decisions"]:
            stats["decisions"][d] += 1
    return result


def _compact(result: Dict) -> Dict:
    keys = ("decision", "confidence", "max_raw", "votes_count", "total_models",
            "script", "fingilish_detected", "decided_by", "latency_ms")
    return {k: result.get(k) for k in keys}


def _count_request():
    with _counter_lock:
        stats["requests"] += 1


def _models_info() -> List[Dict]:
    out = []
    for name, spec in MODEL_SPECS.items():
        out.append({
            "id": name,
            "label": spec["label"],
            "label_en": spec["label_en"],
            "language": spec["lang"],
            "weight": spec["weight"],
            "loaded": name in state["models"],
            "error": state["errors"].get(name),
        })
    return out


ENDPOINTS = [
    {"method": "GET",  "path": "/health",                "summary": "service readiness"},
    {"method": "GET",  "path": "/api/v1/health",         "summary": "service readiness (v1 alias)"},
    {"method": "GET",  "path": "/api/v1/info",           "summary": "name, version, limits, endpoints"},
    {"method": "GET",  "path": "/api/v1/models",         "summary": "the five classifiers and their state"},
    {"method": "GET",  "path": "/api/v1/thresholds",     "summary": "consensus voting thresholds"},
    {"method": "GET",  "path": "/api/v1/stats",          "summary": "uptime, request and decision counters"},
    {"method": "POST", "path": "/api/v1/check",          "summary": "analyse one text"},
    {"method": "POST", "path": "/api/v1/check/batch",    "summary": f"analyse up to {MAX_BATCH_ITEMS} texts"},
    {"method": "POST", "path": "/api/v1/detect",         "summary": "script and Fingilish detection (no models)"},
    {"method": "POST", "path": "/api/v1/fingilish",      "summary": "transliterate Fingilish to Persian"},
    {"method": "POST", "path": "/api/check",             "summary": "legacy single check (errors as 200)"},
]


@app.get("/health", tags=["status"])
def health():
    _count_request()
    return {
        "status": "ok" if state["ready"] and state["models"] else
                  ("loading" if not state["ready"] else "error"),
        "loaded_models": [MODEL_SPECS[name]["label"] for name in state["models"]],
        "errors": dict(state["errors"]),
        "inflight": state["inflight"],
        "peak": state["peak"],
        "concurrency": MAX_CONCURRENT_INFERENCES,
        "version": APP_VERSION,
    }


@app.get("/api/v1/health", tags=["status"])
def health_v1():
    return health()


@app.get("/api/v1/info", tags=["status"])
def info():
    _count_request()
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "languages": ["fa", "fingilish", "en"],
        "decisions": ["SAFE", "SUSPECT", "TOXIC"],
        "limits": {"max_text_length": MAX_TEXT_LENGTH, "max_batch_items": MAX_BATCH_ITEMS,
                   "max_concurrent_inferences": MAX_CONCURRENT_INFERENCES},
        "docs": {"swagger": "/docs", "redoc": "/redoc", "openapi": "/openapi.json"},
        "endpoints": ENDPOINTS,
    }


@app.get("/api/v1/models", tags=["status"])
def models():
    _count_request()
    items = _models_info()
    return {"count": len(items), "loaded": sum(m["loaded"] for m in items), "models": items}


@app.get("/api/v1/thresholds", tags=["status"])
def thresholds():
    _count_request()
    names = ("PER_MODEL_VOTE_THRESHOLD", "MIN_VOTES_FOR_TOXIC", "STRONG_SINGLE_MODEL",
             "WEAK_SUSPECT_THRESHOLD", "FINGILISH_STRONG_SINGLE",
             "SOLO_VOTE_CORROBORATION_FLOOR", "SOLO_VOTE_SUSPECT_FLOOR", "SPECIALIST_SAFE_FLOOR")
    return {n.lower(): getattr(_consensus, n) for n in names if hasattr(_consensus, n)}


@app.get("/api/v1/stats", tags=["status"])
def get_stats():
    _count_request()
    with _counter_lock:
        snap = {k: (dict(v) if isinstance(v, dict) else v) for k, v in stats.items()}
    snap.update({"uptime_s": round(time.time() - STARTED_AT), "inflight": state["inflight"],
                 "peak": state["peak"], "concurrency": MAX_CONCURRENT_INFERENCES})
    return snap


@app.post("/api/v1/check", tags=["analysis"])
def check_v1(data: CheckIn):
    _count_request()
    problem = _text_problem(data.text)
    if problem:
        return _error(*problem)
    try:
        result = _guarded_predict(data.text)
    except Exception as exc:
        print(f"[Ensemble] /api/v1/check EXC:\n{traceback.format_exc()}", flush=True)
        return _error(500, "internal_error", f"{type(exc).__name__}: {exc}")
    if "error" in result:
        return _error(503, "no_models_applicable", str(result["error"]))
    return result if data.detailed else _compact(result)


@app.post("/api/v1/check/batch", tags=["analysis"])
def check_batch(data: BatchIn):
    _count_request()
    if not data.texts:
        return _error(400, "empty_batch", "texts must contain at least one item")
    if len(data.texts) > MAX_BATCH_ITEMS:
        return _error(413, "batch_too_large", f"max {MAX_BATCH_ITEMS} texts per batch")
    if not state["ready"] or not state["models"]:
        return _error(503, "models_loading", "models are still loading, retry in a few seconds")
    t0 = time.perf_counter()
    items, summary = [], {"SAFE": 0, "SUSPECT": 0, "TOXIC": 0, "errors": 0}
    for i, text in enumerate(data.texts):
        problem = _text_problem(text)
        if problem:
            summary["errors"] += 1
            items.append({"index": i, "error": {"code": problem[1], "message": problem[2]}})
            continue
        try:
            result = _guarded_predict(text)
        except Exception as exc:
            result = {"error": f"{type(exc).__name__}: {exc}"}
        if "error" in result:
            summary["errors"] += 1
            items.append({"index": i, "error": {"code": "analysis_failed", "message": str(result["error"])}})
            continue
        summary[result["decision"]] += 1
        items.append({"index": i, **(result if data.detailed else _compact(result))})
    with _counter_lock:
        stats["batches"] += 1
    worst_decision = worst(it["decision"] for it in items if "decision" in it) if any(
        "decision" in it for it in items) else None
    return {"count": len(items), "worst": worst_decision, "summary": summary,
            "latency_ms": round((time.perf_counter() - t0) * 1000), "results": items}


@app.post("/api/v1/detect", tags=["language"])
def detect(data: TextIn):
    _count_request()
    problem = _text_problem(data.text, need_models=False)
    if problem:
        return _error(*problem)
    script = detect_script(data.text)
    fingilish = script == "en" and looks_like_fingilish(data.text)
    converted = fingilish_to_persian(data.text) if fingilish else None
    return {"script": script, "fingilish_detected": fingilish, "fingilish_text": converted,
            "length": len(data.text)}


@app.post("/api/v1/fingilish", tags=["language"])
def fingilish(data: TextIn):
    _count_request()
    problem = _text_problem(data.text, need_models=False)
    if problem:
        return _error(*problem)
    return {"input": data.text, "output": fingilish_to_persian(data.text),
            "looks_like_fingilish": looks_like_fingilish(data.text)}


@app.post("/api/check", tags=["analysis"])
def check(data: TextIn):
    """Legacy endpoint: same result as /api/v1/check, errors come back as 200 {"error": "..."}."""
    _count_request()
    try:
        problem = _text_problem(data.text)
        if problem:
            return {"error": problem[2]}
        return _guarded_predict(data.text)
    except Exception as exc:
        print(f"[Ensemble] /api/check EXC:\n{traceback.format_exc()}", flush=True)
        return {"error": f"{type(exc).__name__}: {exc}"}


def _asset_version() -> str:
    h = hashlib.sha1()
    for f in ("tokens.css", "style.css", "script.js"):
        try:
            h.update((BASE_DIR / "static" / f).read_bytes())
        except OSError:
            pass
    return h.hexdigest()[:10]


# Cache-bust CSS/JS on every deploy, otherwise browsers (and the Cloudflare
# edge) can keep serving the previous script.js after an update.
_INDEX_HTML = (BASE_DIR / "static" / "index.html").read_text(encoding="utf-8") \
    .replace("__V__", _asset_version())


@app.get("/", include_in_schema=False)
def index():
    return HTMLResponse(_INDEX_HTML, headers={"Cache-Control": "no-cache"})


app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
