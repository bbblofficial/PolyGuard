"""Smoke test against a running server:  python scripts/smoke_test.py [base_url]"""
import json
import sys
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

sys.exit(1 if failed else 0)
