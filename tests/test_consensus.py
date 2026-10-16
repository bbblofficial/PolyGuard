from app.consensus import decide, detect_script, worst


def test_two_votes_is_toxic():
    d, votes, n, mx, _ = decide({"a": 0.7, "b": 0.6, "c": 0.1})
    assert d == "TOXIC" and n == 2 and mx == 0.7


def test_single_strong_vote_is_toxic():
    assert decide({"a": 0.95, "b": 0.1})[0] == "TOXIC"


def test_single_vote_needs_more_when_strict():
    assert decide({"a": 0.92, "b": 0.1}, strict=True)[0] == "SUSPECT"
    assert decide({"a": 0.99, "b": 0.1}, strict=True)[0] == "TOXIC"


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
