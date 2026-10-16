"""
Pure (torch-free) decision logic of the ensemble, so it can be unit-tested
without downloading any model.
"""
import re
from typing import Dict, Tuple

PER_MODEL_VOTE_THRESHOLD = 0.50
MIN_VOTES_FOR_TOXIC = 2
STRONG_SINGLE_MODEL = 0.90
WEAK_SUSPECT_THRESHOLD = 0.60
# A transliterated (Fingilish) reading is a guess, so a single model needs
# more certainty before it may declare TOXIC on its own.
FINGILISH_STRONG_SINGLE = 0.95

SEVERITY = {"SAFE": 0, "SUSPECT": 1, "TOXIC": 2}


def detect_script(text: str) -> str:
    fa = len(re.findall(r'[؀-ۿ]', text))
    en = len(re.findall(r'[A-Za-z]', text))
    total = fa + en
    if total == 0:
        return "mixed"
    if fa / total >= 0.6:
        return "fa"
    if en / total >= 0.6:
        return "en"
    return "mixed"


def decide(raw: Dict[str, float], strict: bool = False) -> Tuple[str, Dict[str, bool], int, float, float]:
    """raw = {model_name: toxic_probability}.

    Returns (decision, votes, votes_count, max_raw, confidence).
    """
    votes = {name: s >= PER_MODEL_VOTE_THRESHOLD for name, s in raw.items()}
    votes_count = sum(votes.values())
    max_raw = max(raw.values())
    strong = FINGILISH_STRONG_SINGLE if strict else STRONG_SINGLE_MODEL

    if votes_count >= MIN_VOTES_FOR_TOXIC:
        decision = "TOXIC"
    elif votes_count == 1 and max_raw >= strong:
        decision = "TOXIC"
    elif max_raw >= WEAK_SUSPECT_THRESHOLD:
        decision = "SUSPECT"
    else:
        decision = "SAFE"

    top2 = sorted(raw.values(), reverse=True)[:2]
    confidence = round(sum(top2) / len(top2), 4)
    return decision, votes, votes_count, max_raw, confidence


def worst(decisions) -> str:
    return max(decisions, key=lambda d: SEVERITY.get(d, 0))
