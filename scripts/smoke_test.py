"""Smoke test against a running server:  python scripts/smoke_test.py [base_url]"""
import json
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"


def check(text):
    req = urllib.request.Request(
        BASE + "/api/check",
        data=json.dumps({"text": text}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


CASES = [
    # text, expected decision(s), expected fingilish_detected
    ("kir",                                         {"TOXIC"},            True),
    ("to khar hasti",                               {"TOXIC", "SUSPECT"}, True),
    ("khafe sho ahmagh",                            {"TOXIC", "SUSPECT"}, True),
    ("salam khoobi? man khoobam mersi",             {"SAFE", "SUSPECT"},  True),
    ("Have a wonderful and productive day ahead!",  {"SAFE"},             False),
    ("hi",                                          {"SAFE", "SUSPECT"},  False),
    ("You are completely stupid and useless",       {"TOXIC", "SUSPECT"}, False),
    ("سلام وقت بخیر، از همکاری با شما بسیار خوشحالم.", {"SAFE"},            False),
]

failed = 0
for text, decisions, fing in CASES:
    r = check(text)
    ok = r.get("decision") in decisions and bool(r.get("fingilish_detected")) == fing
    failed += not ok
    print(("PASS" if ok else "FAIL"), repr(text),
          {k: r.get(k) for k in ("decision", "fingilish_detected", "fingilish_text", "max_raw", "error")})

with ThreadPoolExecutor(8) as ex:
    results = list(ex.map(check, ["You are crazy"] * 8))
bad = [r for r in results if "decision" not in r]
print("PASS" if not bad else "FAIL", f"8 parallel requests, {len(bad)} errors")
failed += bool(bad)

# v1 API surface
def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)

V1 = [
    ("GET",  "/api/v1/health",      None,                                   200, "status"),
    ("GET",  "/api/v1/info",        None,                                   200, "endpoints"),
    ("GET",  "/api/v1/models",      None,                                   200, "models"),
    ("GET",  "/api/v1/thresholds",  None,                                   200, "per_model_vote_threshold"),
    ("GET",  "/api/v1/stats",       None,                                   200, "uptime_s"),
    ("POST", "/api/v1/check",       {"text": "Have a nice day"},            200, "decision"),
    ("POST", "/api/v1/check",       {"text": "  "},                         400, "error"),
    ("POST", "/api/v1/check/batch", {"texts": ["salam", "You are stupid"]}, 200, "summary"),
    ("POST", "/api/v1/detect",      {"text": "salam khoobi?"},              200, "script"),
    ("POST", "/api/v1/fingilish",   {"text": "merci ke komak kardi"},       200, "output"),
]
for method, path, body, want, key in V1:
    code, data = call(method, path, body)
    ok = code == want and key in data
    failed += not ok
    print(("PASS" if ok else "FAIL"), method, path, code)

sys.exit(1 if failed else 0)
