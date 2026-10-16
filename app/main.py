import os

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

import re
import time
import traceback
import threading
from pathlib import Path
from typing import Dict

import torch
torch.set_num_threads(1)

from anyio import to_thread
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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
MODELS_ROOT = Path(os.environ["MODELS_ROOT"])


class TextIn(BaseModel):
    text: str   # no length limit


state = {"models": {}, "errors": {}, "ready": False, "inflight": 0, "peak": 0}

MODEL_SPECS = {
    "persian":      {"dir": MODELS_ROOT / "persian",           "mode": "multilabel", "weight": 2.0, "lang": "fa",    "label": "Persian ParsBERT (تخصصی فارسی)",      "label_en": "Persian ParsBERT"},
    "textdetox_lg": {"dir": MODELS_ROOT / "textdetox_large",   "mode": "binary",     "weight": 2.0, "lang": "multi", "label": "TextDetox XLM-R Large (۱۵ زبان)",     "label_en": "TextDetox XLM-R Large"},
    "textdetox_sm": {"dir": MODELS_ROOT / "textdetox_base",    "mode": "binary",     "weight": 1.5, "lang": "multi", "label": "TextDetox XLM-R Base (۱۵ زبان)",      "label_en": "TextDetox XLM-R Base"},
    "multilingual": {"dir": MODELS_ROOT / "multilingual",      "mode": "multilabel", "weight": 1.0, "lang": "multi", "label": "Unitary XLM-R (چندزبانه ۱۰۰+)",       "label_en": "Unitary XLM-R"},
    "twitter_off":  {"dir": MODELS_ROOT / "twitter_offensive", "mode": "binary",     "weight": 1.0, "lang": "en",    "label": "Twitter RoBERTa Offensive (انگلیسی)", "label_en": "Twitter RoBERTa Offensive"},
}

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
        state["models"][name] = (
            mdl, tok, spec["mode"], spec["weight"],
            spec["lang"], spec["label"], spec["label_en"],
        )
        print(f"[Ensemble] OK '{name}' loaded", flush=True)
    except Exception as exc:
        state["errors"][name] = str(exc)
        print(f"[Ensemble] FAILED '{name}': {exc}", flush=True)


def _bootstrap():
    print("[Ensemble] Bootstrap starting...", flush=True)
    for name, spec in MODEL_SPECS.items():
        _load_one(name, spec)
    state["ready"] = True
    print(f"[Ensemble] Ready. Loaded: {list(state['models'].keys())} "
          f"Errors: {list(state['errors'].keys())}", flush=True)


_bootstrap()


# ------------------------------------------------------------------
# Scoring
# ------------------------------------------------------------------
def _score_multilabel(model, tokenizer, text):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.inference_mode():
        logits = model(**inputs).logits
    return float(torch.sigmoid(logits).squeeze(0).max().item())


def _score_binary(model, tokenizer, text):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.inference_mode():
        logits = model(**inputs).logits
    probs = torch.softmax(logits, dim=-1).squeeze(0)
    if probs.numel() == 1:
        return float(probs.item())
    return float(probs[1].item())


# ------------------------------------------------------------------
# Ensemble voting - pure function, returns a fresh dict
# ------------------------------------------------------------------
def _run_ensemble(text: str, script: str, strict: bool = False) -> Dict:
    models_snapshot = list(state["models"].items())

    raw, weighted, weights, labels, labels_en, skipped = {}, {}, {}, {}, {}, []
    for name, (mdl, tok, mode, weight, lang, label, label_en) in models_snapshot:
        if script == "fa" and lang == "en":
            skipped.append(name)
            continue
        if script == "en" and lang == "fa":
            skipped.append(name)
            continue

        try:
            s = _score_binary(mdl, tok, text) if mode == "binary" \
                else _score_multilabel(mdl, tok, text)
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

    decision, votes, votes_count, max_raw, confidence = decide(raw, strict=strict)
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
app = FastAPI(title="PolyGuard Ensemble")


@app.on_event("startup")
async def _on_startup():
    to_thread.current_default_thread_limiter().total_tokens = MAX_THREADPOOL_TOKENS
    print(f"[Ensemble] Worker ready. cpu={CPU_COUNT} "
          f"parallel_inferences={MAX_CONCURRENT_INFERENCES} "
          f"threadpool={MAX_THREADPOOL_TOKENS}", flush=True)


@app.get("/health")
def health():
    return {
        "status": "ok" if state["ready"] and state["models"] else
                  ("loading" if not state["ready"] else "error"),
        "loaded_models": list(state["models"].keys()),
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


@app.get("/")
def index():
    return FileResponse(BASE_DIR / "static" / "index.html",
                        headers={"Cache-Control": "no-cache"})


app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
