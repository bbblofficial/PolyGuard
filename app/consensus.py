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
# suspicious of the text. Without this floor, a single miscalibrated
# checkpoint (e.g. a narrow fine-tuned classifier that spikes to ~100% on
# text every other model, including other models trained for the same
# language, scores near 0%) can override a unanimous "safe" consensus from
# every other model. That exact pattern - one model at 100%, the rest at
# 0-2% - is what let the Persian model alone label ordinary, polite text as
# TOXIC. Requiring a second, independent model to show at least some
# suspicion before trusting a solo strong vote fixes that failure mode while
# still letting a real specialist catch something the others miss, as long
# as it isn't the *only* model raising any suspicion at all.
SOLO_VOTE_CORROBORATION_FLOOR = 0.30

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
    # The next-highest score from a *different* model - used to tell a real
    # specialist catch apart from a lone miscalibrated outlier (see
    # SOLO_VOTE_CORROBORATION_FLOOR above).
    second_raw = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
    strong = FINGILISH_STRONG_SINGLE if strict else STRONG_SINGLE_MODEL

    if votes_count >= MIN_VOTES_FOR_TOXIC:
        decision = "TOXIC"
    elif (votes_count == 1 and max_raw >= strong
          and second_raw >= SOLO_VOTE_CORROBORATION_FLOOR):
        decision = "TOXIC"
    elif max_raw >= WEAK_SUSPECT_THRESHOLD:
        # STRONG_SINGLE_MODEL/FINGILISH_STRONG_SINGLE are always >=
        # WEAK_SUSPECT_THRESHOLD, so this branch also catches the
        # uncorroborated solo-strong-vote case: it's still surfaced
        # prominently as SUSPECT (not silently dropped to SAFE), just no
        # longer auto-blocked as TOXIC on one model's say-so.
        decision = "SUSPECT"
    else:
        decision = "SAFE"

    top2 = sorted_scores[:2]
    confidence = round(sum(top2) / len(top2), 4)
    return decision, votes, votes_count, max_raw, confidence


def worst(decisions) -> str:
    return max(decisions, key=lambda d: SEVERITY.get(d, 0))
