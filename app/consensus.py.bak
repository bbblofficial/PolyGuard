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

# A lone model - however confident - is not allowed to convict on its own
# unless at least one other applicable model is *also* at least mildly
# suspicious of the text.
SOLO_VOTE_CORROBORATION_FLOOR = 0.30

# If a solo strong vote has essentially *zero* corroboration - every other
# applicable model sits below this floor - the outlier is treated as SAFE
# rather than SUSPECT. A single checkpoint firing at 100% on ordinary text
# while every other model confidently says "safe" is not a weak signal worth
# reviewing; it is a miscalibration pattern.
SOLO_VOTE_SUSPECT_FLOOR = 0.10

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
    sorted_scores = sorted(raw.values(), reverse=True)
    max_raw = sorted_scores[0]
    # The next-highest score from a *different* model.
    second_raw = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
    strong = FINGILISH_STRONG_SINGLE if strict else STRONG_SINGLE_MODEL

    if votes_count >= MIN_VOTES_FOR_TOXIC:
        decision = "TOXIC"
    elif votes_count == 1 and max_raw >= strong:
        # A lone strong vote. Trust it only if at least one other applicable
        # model is also at least mildly suspicious.
        if second_raw >= SOLO_VOTE_CORROBORATION_FLOOR:
            decision = "TOXIC"
        elif second_raw >= SOLO_VOTE_SUSPECT_FLOOR:
            decision = "SUSPECT"
        else:
            # No other model sees anything at all: the classic
            # "one checkpoint spikes to ~100% on clean text while every
            # other model agrees it's safe" failure mode.
            decision = "SAFE"
    elif max_raw >= WEAK_SUSPECT_THRESHOLD:
        # A single model in the 0.60-0.90 range without corroboration:
        # worth a human look, but not a conviction.
        decision = "SUSPECT"
    else:
        decision = "SAFE"

    top2 = sorted_scores[:2]
    confidence = round(sum(top2) / len(top2), 4)
    return decision, votes, votes_count, max_raw, confidence


def worst(decisions) -> str:
    return max(decisions, key=lambda d: SEVERITY.get(d, 0))