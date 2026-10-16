from app.consensus import decide, detect_script, worst


def test_two_votes_is_toxic():
    d, votes, n, mx, _ = decide({"a": 0.7, "b": 0.6, "c": 0.1})
    assert d == "TOXIC" and n == 2 and mx == 0.7


def test_single_strong_vote_with_corroboration_is_toxic():
    # One model is very confident AND a second, independent model is also
    # at least mildly suspicious -> trust the specialist.
    assert decide({"a": 0.95, "b": 0.4})[0] == "TOXIC"


def test_single_strong_vote_without_corroboration_is_suspect_not_toxic():
    # Regression test for the real bug report: one model (e.g. the Persian
    # checkpoint) spikes to ~100% on completely clean text while every
    # other applicable model confidently disagrees (~0-2%). A lone outlier
    # contradicted by the rest of the ensemble must not auto-convict.
    decision, votes, votes_count, max_raw, confidence = decide(
        {"persian": 1.0, "textdetox_lg": 0.001, "textdetox_sm": 0.0, "multilingual": 0.015}
    )
    assert decision == "SUSPECT"
    assert votes_count == 1
    assert max_raw == 1.0


def test_single_vote_needs_more_when_strict():
    assert decide({"a": 0.92, "b": 0.1}, strict=True)[0] == "SUSPECT"
    # Even at 0.99, an uncorroborated lone vote in strict (Fingilish) mode
    # stays SUSPECT - a guessed transliteration gets even less benefit of
    # the doubt than a native-script solo vote.
    assert decide({"a": 0.99, "b": 0.1}, strict=True)[0] == "SUSPECT"
    assert decide({"a": 0.99, "b": 0.5}, strict=True)[0] == "TOXIC"


def test_single_weak_vote_is_suspect():
    assert decide({"a": 0.7, "b": 0.1})[0] == "SUSPECT"


def test_safe():
    assert decide({"a": 0.2, "b": 0.1})[0] == "SAFE"


def test_worst():
    assert worst(["SAFE", "TOXIC", "SUSPECT"]) == "TOXIC"
    assert worst(["SAFE"]) == "SAFE"


def test_detect_script():
    assert detect_script("hello world") == "en"
    assert detect_script("سلام دوست من") == "fa"
    assert detect_script("1234") == "mixed"
