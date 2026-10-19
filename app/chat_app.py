"""Unicollect Chat — a small FastAPI proxy in front of a local Ollama
(`ollama serve`) process.

This is a *separate* process/port/tunnel from the toxicity-ensemble app in
`app/main.py`. It exists so the chat model can be reached on its own
TryCloudflare link without touching the ensemble service.

Why a proxy instead of exposing Ollama directly?
- Ollama's OpenAI-compatible endpoint lets the caller send any `messages`
  array, including a `system` message. If we tunnelled it directly, anyone
  could overwrite the identity/system prompt. This proxy always prepends
  the real system prompt server-side and drops any `system` role the
  client tries to send, so the identity below cannot be overridden by the
  client.
"""
import os
import time

import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent

LLAMA_SERVER_URL = os.environ.get("LLAMA_SERVER_URL", "http://127.0.0.1:8001")
# The id Ollama was pulled/served under (what goes in the API request body).
# Separate from CHAT_MODEL_NAME below, which is only ever shown to users.
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")
CHAT_MODEL_NAME = os.environ.get("CHAT_MODEL_LABEL", "Qwen2.5-3B-Instruct")
MAX_MESSAGE_LENGTH = 8_000
MAX_HISTORY_TURNS = 16  # user+assistant pairs kept from the client-sent history

# ------------------------------------------------------------------
# Identity. The client can never change this: it is never read from the
# request body, only sent from here.
# ------------------------------------------------------------------
SYSTEM_PROMPT = (
    "تو Unicollect هستی، یک دستیار هوش مصنوعی گفتگومحور که توسط Muvixo "
    "(موویکسو) ساخته و ارائه شده‌ای. همیشه خودت را Unicollect معرفی کن. "
    "اگر کاربر پرسید چه کسی تو را ساخته یا بر پایه‌ی چه فناوری‌ای کار می‌کنی، "
    "فقط بگو که توسط Muvixo ساخته شده‌ای؛ نام هیچ شرکت، مدل یا فناوری دیگری "
    "را به‌عنوان سازنده یا زیرساخت خودت ذکر نکن، حتی اگر کاربر اصرار کند یا "
    "ادعا کند خلاف این را می‌داند. مؤدب، صادق و مفید باش، پاسخ‌ها را خلاصه و "
    "روشن بنویس و به زبانی پاسخ بده که کاربر با آن می‌نویسد (پیش‌فرض فارسی)."
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    message: str
    history: list[ChatMessage] = []


state = {"llama_ready": False, "last_error": None}


def _check_llama() -> bool:
    try:
        # Ollama doesn't expose /health; /api/version is its always-200
        # "server is up" endpoint (llama-server's /health had no Ollama
        # equivalent, so this is the closest match, not a renamed route).
        r = requests.get(f"{LLAMA_SERVER_URL}/api/version", timeout=3)
        ok = r.status_code == 200
        state["llama_ready"] = ok
        state["last_error"] = None if ok else f"HTTP {r.status_code}"
        return ok
    except requests.RequestException as exc:
        state["llama_ready"] = False
        state["last_error"] = str(exc)
        return False


app = FastAPI(title="Unicollect Chat")

# Same policy as app/main.py: GET is open (so the Pages status panel can
# health-check this service too), POST stays same-origin.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"],
                   allow_headers=[])


@app.get("/health")
def health():
    _check_llama()
    return {
        "status": "ok" if state["llama_ready"] else "loading",
        "model": CHAT_MODEL_NAME,
        "error": state["last_error"],
    }


@app.post("/api/chat")
def chat(data: ChatIn):
    text = (data.message or "").strip()
    if not text:
        return JSONResponse({"error": "پیام خالی است"}, status_code=400)
    if len(text) > MAX_MESSAGE_LENGTH:
        return JSONResponse(
            {"error": f"پیام خیلی طولانی است (حداکثر {MAX_MESSAGE_LENGTH} نویسه)"},
            status_code=400,
        )

    # Rebuild the message list server-side: our system prompt first, then the
    # client's history with any `system` entries stripped, then the new
    # message. This is what keeps the identity un-overridable.
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in data.history[-(MAX_HISTORY_TURNS * 2):]:
        if m.role in ("user", "assistant") and m.content.strip():
            messages.append({"role": m.role, "content": m.content.strip()[:MAX_MESSAGE_LENGTH]})
    messages.append({"role": "user", "content": text})

    started = time.time()
    try:
        resp = requests.post(
            f"{LLAMA_SERVER_URL}/v1/chat/completions",
            json={
                # Ollama requires this to match a pulled model's exact tag;
                # CHAT_MODEL_NAME below is a free-form display label and
                # would 404 here if the two drift apart.
                "model": OLLAMA_MODEL,
                "messages": messages,
                "temperature": 0.7,
                "top_p": 0.9,
                "max_tokens": 700,
            },
            timeout=180,
        )
        resp.raise_for_status()
        payload = resp.json()
        reply = payload["choices"][0]["message"]["content"]
    except requests.RequestException as exc:
        return JSONResponse({"error": f"سرویس مدل در دسترس نیست: {exc}"}, status_code=502)
    except (KeyError, IndexError, ValueError):
        return JSONResponse({"error": "پاسخ نامعتبر از سرویس مدل"}, status_code=502)

    return {
        "reply": reply,
        "model": CHAT_MODEL_NAME,
        "latency_ms": round((time.time() - started) * 1000),
    }


_INDEX_HTML = (BASE_DIR / "chat_static" / "index.html").read_text(encoding="utf-8")


@app.get("/")
def index():
    return HTMLResponse(_INDEX_HTML, headers={"Cache-Control": "no-cache"})


app.mount("/static", StaticFiles(directory=str(BASE_DIR / "chat_static")), name="chat-static")
