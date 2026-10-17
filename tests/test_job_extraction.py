"""
Test Suite: job-description feature extraction via the local LLM
(job_extraction.py)
-------------------------------------------------------------------
Validates the Flan-T5 replacement: the SAME single local GGUF model
(Qwen2.5, see why_matched.py) now powers the two extraction paths:

1. extract_job_features()  -> task intensity / schedule flexibility / skills
   (fallback enrichment when a job record has no structured data).
2. extract_posting_features() -> skills / posture / communication / pace tags
   for the employer posting assistant.

Contract:
- Prompt builders embed the description and demand a strict one-line format.
- Parsers tolerate messy model replies (case, trailing periods, extra
  lines) and fall back to safe defaults on missing fields.
- The extractors raise when no local LLM is available, so callers can keep
  their deterministic defaults (no feature is ever lost).

Run directly:  .venv\\Scripts\\python.exe tests\\test_job_extraction.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from job_extraction import (
    build_feature_messages,
    build_posting_messages,
    parse_feature_reply,
    parse_posting_reply,
    extract_job_features,
    extract_posting_features,
)

DESC = "Clean rooms, sweep floors, wipe tables, do the laundry. Work indoors in offices."
PHYS = "Standing and walking most of the shift."


class FakeLLM:
    """Minimal llama-cpp-python stand-in returning a canned reply."""

    model_path = "fake.gguf"

    def __init__(self, reply):
        self.reply = reply
        self.calls = []

    def create_chat_completion(self, messages, **kwargs):
        self.calls.append(messages)
        return {
            "choices": [{"message": {"content": self.reply}}],
            "usage": {"completion_tokens": 42},
        }


def test_build_feature_messages_include_context_and_format():
    msgs = build_feature_messages(DESC, PHYS)
    assert msgs[0]["role"] == "system" and msgs[1]["role"] == "user"
    assert "one line" in msgs[0]["content"].lower()
    assert DESC in msgs[1]["content"] and PHYS in msgs[1]["content"]
    assert "Intensity:" in msgs[1]["content"] and "Flexibility:" in msgs[1]["content"]


def test_build_posting_messages_include_context_and_format():
    msgs = build_posting_messages("Maid", DESC)
    assert "one line" in msgs[0]["content"].lower()
    assert "Maid" in msgs[1]["content"] and DESC in msgs[1]["content"]
    for label in ("Skills:", "Posture:", "Communication:", "Pace:"):
        assert label in msgs[1]["content"]


def test_parse_feature_reply_well_formed():
    reply = "Intensity: Medium, Flexibility: Yes, Skills: cleaning, cooking, organizing"
    out = parse_feature_reply(reply)
    assert out["intensity"] == "Medium"
    assert out["flexibility"] == 1
    assert out["skills"] == "cleaning, cooking, organizing"


def test_parse_feature_reply_tolerates_messy_reply():
    reply = "intensity: high, flexibility: NO, Skills: pc repair, cable management.\nHope this helps!"
    out = parse_feature_reply(reply)
    assert out["intensity"] == "High"  # normalized case
    assert out["flexibility"] == 0
    assert out["skills"] == "pc repair, cable management"  # trailing period stripped


def test_parse_feature_reply_missing_fields_fall_back():
    out = parse_feature_reply("I cannot determine this from the text.")
    assert out["intensity"] is None
    assert out["flexibility"] == 0
    assert out["skills"] == ""


def test_extract_job_features_requires_llm():
    try:
        extract_job_features(None, DESC, PHYS)
    except RuntimeError:
        pass
    else:
        raise AssertionError("expected RuntimeError when no local LLM is available")


def test_extract_job_features_with_fake_llm():
    llm = FakeLLM("Intensity: High, Flexibility: No, Skills: heavy lifting, mopping")
    out = extract_job_features(llm, DESC, PHYS)
    assert out["intensity"] == "High" and out["flexibility"] == 0
    assert out["skills"] == "heavy lifting, mopping"
    assert DESC in llm.calls[-1][1]["content"]  # the real description reached the model


def test_parse_posting_reply_well_formed():
    reply = (
        "Skills: data entry, google sheets, customer service | Posture: Mostly Seated | "
        "Communication: Text-First | Pace: Self-Paced"
    )
    out = parse_posting_reply(reply)
    assert out["skills"] == ["data entry", "google sheets", "customer service"]
    assert out["posture"] == "Mostly Seated"
    assert out["communication"] == "Text-First"
    assert out["pace"] == "Self-Paced"


def test_parse_posting_reply_missing_fields_fall_back():
    out = parse_posting_reply("Sorry, no information.")
    assert out["skills"] == []
    assert out["posture"] == "Mostly Seated"
    assert out["communication"] == "Mixed"
    assert out["pace"] == "Standard"


def test_parse_posting_reply_ignores_extra_text_and_comma_format():
    reply = (
        "Skills: answering phones, filing, Posture: Mixed Standing, Communication: Mixed, Pace: Standard\n"
        "This posting sounds great!"
    )
    out = parse_posting_reply(reply)
    assert out["skills"] == ["answering phones", "filing"]
    assert out["posture"] == "Mixed Standing"
    assert out["pace"] == "Standard"


def test_extract_posting_features_requires_llm():
    try:
        extract_posting_features(None, "Maid", DESC)
    except RuntimeError:
        pass
    else:
        raise AssertionError("expected RuntimeError when no local LLM is available")


def test_extract_posting_features_with_fake_llm():
    llm = FakeLLM("Skills: cleaning, organizing | Posture: Physical Handling | Communication: Text-First | Pace: Fast-Paced")
    out = extract_posting_features(llm, "Maid", DESC)
    assert out["skills"] == ["cleaning", "organizing"]
    assert out["posture"] == "Physical Handling"
    assert "Maid" in llm.calls[-1][1]["content"]


if __name__ == "__main__":
    import traceback

    failures = 0
    tests = [
        (name, fn)
        for name, fn in sorted(globals().items())
        if name.startswith("test_") and callable(fn)
    ]
    for name, fn in tests:
        try:
            fn()
            print(f"PASS {name}")
        except Exception:
            failures += 1
            print(f"FAIL {name}")
            traceback.print_exc()
    print(f"\n{len(tests) - failures}/{len(tests)} tests passed")
    raise SystemExit(1 if failures else 0)
