"""
Test Suite: Grounded "Why matched?" verbalizer (why_matched.py)
---------------------------------------------------------------
Validates the no-hallucination contract of the two-layer verbalizer:

1. Deterministic plain drafts (compose_plain_drafts) are built only from
   verified engine verdicts, contain no numbers, and land a simple,
   accurate message for mismatch / marginal / all-good cases.
2. Per-section prompting is self-contained (system + note + rewrite request).
3. The verification guard rejects ungrounded numbers, unbacked claim words
   (praise/intensity/experience vocabulary the verified note never used),
   copied expert text, banned fragments, truncated, empty and rambling
   output.
4. Every number a section may legally use comes from that section's own
   note (no cross-section number leakage).
5. Generation never raises; every failure path falls back to the
   deterministic plain draft.

Run directly:  .venv\\Scripts\\python.exe tests\\test_why_matched_guard.py
"""

import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from why_matched import (
    build_notes,
    compose_plain_drafts,
    _section_messages,
    verify_section,
    extract_numbers,
    generate_why_matched,
)

METRICS = {"safety": 70.0, "skills": 60.0, "stamina": 50.0, "ontology": 80.0}
FACTS = {
    "analysis": "Overall fit is 80 percent strong with minor stretch.",
    "performance": "Skills cover most duties; 3 gaps remain small.",
    "advice": "Recommended accommodations: flexible seating.",
    "hinder": "No significant barriers detected.",
    "barriers": ["stamina"],
}
EXPLANATIONS = [
    {"dimension_key": "physical_mobility_exertion", "dimension": "Physical Mobility And Exertion", "verdict": "mismatch"},
    {"dimension_key": "fine_motor", "dimension": "Fine-Motor Coordination And Manual Dexterity", "verdict": "match"},
    {"dimension_key": "cognitive", "dimension": "Cognitive And Analytical Tasks", "verdict": "match"},
]
OVERLAP = ["cleaning"]
ACCOMMODATIONS = ["Wheelchair-accessible office", "Level floor access"]


def make_drafts():
    return compose_plain_drafts(
        METRICS, FACTS,
        explanations=EXPLANATIONS,
        overlap_skills=OVERLAP,
        accommodations=ACCOMMODATIONS,
    )


class FakeLLM:
    """Minimal llama-cpp-python stand-in.

    `responder(messages) -> str | Exception` lets tests script per-section
    behaviour; a plain string is returned for every call.
    """

    model_path = "fake.gguf"

    def __init__(self, responder=None):
        self.responder = responder if responder is not None else "Plain fallback text that is long enough."
        self.calls = []

    def create_chat_completion(self, messages, **kwargs):
        self.calls.append(messages)
        result = self.responder(messages) if callable(self.responder) else self.responder
        if isinstance(result, Exception):
            raise result
        return {
            "choices": [{"message": {"content": result}}],
            "usage": {"completion_tokens": 33},
        }


def grounded_responder(messages):
    user = messages[-1]["content"]
    if "Workplace suitability" in user:
        return "You can do this job with the right support, at 80 percent fit. Ask the employer for a safer setup."
    if "Technical skill relevance" in user:
        return "Your cleaning background already fits part of this job. Small gaps are okay at 60 percent."
    if "Stamina compatibility" in user:
        return "Please ask for a flat entrance and reserved parking, at 50 percent stamina fit. These changes keep you safe."
    return "No big problems were found for you. Ask for help when you need it."


def test_compose_drafts_mismatch_case():
    drafts = make_drafts()
    compat = drafts["compatibility"]
    assert "fits you only partly" in compat
    assert "physical mobility and exertion" in compat
    assert "support from the employer" in compat
    assert "Stamina" not in compat  # no cross-dimension leakage


def test_compose_drafts_no_numbers():
    drafts = make_drafts()
    for key in ("compatibility", "performance", "advice"):
        assert not re.search(r"\d", drafts[key]), f"draft {key} should contain no digits"


def test_compose_drafts_match_only_case():
    explanations = [{"dimension": "Work Pace And Tempo", "verdict": "match"}]
    drafts = compose_plain_drafts(METRICS, FACTS, explanations=explanations)
    assert "fits your comfort level well" in drafts["compatibility"]


def test_compose_drafts_advice_uses_accommodations():
    drafts = make_drafts()
    assert "Ask the employer for these changes" in drafts["advice"]
    assert "Wheelchair-accessible office" in drafts["advice"]
    assert "Level floor access" in drafts["advice"]


def test_compose_drafts_skills_and_barrier_in_performance():
    drafts = make_drafts()
    assert "cleaning" in drafts["performance"]
    assert "physical mobility and exertion" in drafts["performance"]


def test_compose_drafts_degrades_gracefully_without_extras():
    drafts = compose_plain_drafts(METRICS, FACTS)
    assert drafts["compatibility"]  # still a usable deterministic sentence set
    assert drafts["advice"] == FACTS["advice"]


def test_section_messages_structure():
    msgs = _section_messages("Workplace suitability is 80 percent. This job fits you well.")
    assert msgs[0]["role"] == "system" and msgs[1]["role"] == "user"
    assert "warm" in msgs[0]["content"].lower()
    assert "Workplace suitability is 80 percent." in msgs[1]["content"]
    assert "Rewrite" in msgs[1]["content"]


def test_verify_section_number_grounding():
    note = "Workplace suitability is 80 percent. Physical safety alignment is 70 percent."
    ok, reason = verify_section("This workplace fits you at 80 percent. Safety is 70% for you.", note)
    assert ok and reason == "ok"
    ok, reason = verify_section("Safety alignment reaches 70.0 percent for you.", note)
    assert ok, reason
    ok, reason = verify_section("You have a 95 percent chance of success here.", note)
    assert not ok and reason.startswith("ungrounded_numbers")


def test_verify_section_rejects_degenerate_output():
    note = "Workplace suitability is 80 percent for this role overall."
    ok, reason = verify_section("Person with disability can do this job.", note)
    assert not ok and reason.startswith("banned")
    ok, reason = verify_section("ok.", note)
    assert not ok and reason == "too_short"
    ok, reason = verify_section("x" * 900, note)
    assert not ok and reason == "too_long"
    ok, reason = verify_section("", note)
    assert not ok and reason == "empty"
    ok, reason = verify_section("This is a sentence cut off in the middle of the", note)
    assert not ok and reason == "looks_truncated"


def test_copied_note_chunk_rejected():
    note = (
        "High demand in physical mobility and exertion exceeds baseline comfort "
        "and should be supported with formal workplace accommodations."
    )
    copied = "High demand in physical mobility and exertion exceeds baseline comfort and should be supported."
    ok, reason = verify_section(copied, note)
    assert not ok and reason == "copied_note_text"
    real_rewrite = "This job needs a lot of physical effort. You may need workplace changes to stay comfortable."
    ok, reason = verify_section(real_rewrite, note)
    assert ok, reason


def test_verify_section_rejects_first_person_voice():
    note = "Workplace suitability is 80 percent. This job fits you only partly."
    ok, reason = verify_section(
        "I am so glad you found this note helpful! It brings warmth to your day.", note
    )
    assert not ok and reason.startswith("first_person")
    ok, reason = verify_section(
        "We'd be happy to help you with this role if needed, anytime soon.", note
    )
    assert not ok and reason.startswith("first_person")
    ok, reason = verify_section(
        "Your skills are a valuable asset to us in this role today.", note
    )
    assert not ok and reason.startswith("first_person")
    ok, reason = verify_section(
        "Here is a rewritten version of the note in warmer, friendlier English today.", note
    )
    assert not ok and reason.startswith("banned")


def test_verify_section_rejects_unbacked_praise():
    note = "Workplace suitability is 80 percent. This job fits your comfort level well."
    ok, reason = verify_section("You're doing very well here and you're great at this job.", note)
    assert not ok and reason.startswith("unbacked_claim")
    assert "great" in reason
    ok, reason = verify_section("You are excellent and this role is perfect for you.", note)
    assert not ok and reason.startswith("unbacked_claim")


def test_verify_section_rejects_unbacked_experience_and_absolutes():
    note = "Technical skill relevance is 60 percent. Your skills already fit part of this job: cleaning."
    ok, reason = verify_section("You will always enjoy this kind of cleaning work.", note)
    assert not ok and reason.startswith("unbacked_claim")
    assert "always" in reason and "enjoy" in reason
    ok, reason = verify_section("Your cleaning skills are a strong base for this job.", note)
    assert not ok and reason.startswith("unbacked_claim")
    assert "strong" in reason


def test_verify_section_allows_claims_backed_by_note_words():
    note = "These parts are easy for you: cleaning. Plan rest for the hard days."
    ok, reason = verify_section("These cleaning parts are easy for you. Rest on the hard days.", note)
    assert ok, reason


def test_generate_falls_back_when_softener_embellishes():
    def responder(messages):
        user = messages[-1]["content"]
        if "Workplace suitability" in user:
            return "You're doing great here and this job is perfect for your needs."
        return grounded_responder(messages)

    report, meta = generate_why_matched(
        FakeLLM(responder), "Maria", "Barista", "Cafe X", METRICS, FACTS,
        explanations=EXPLANATIONS, overlap_skills=OVERLAP, accommodations=ACCOMMODATIONS,
    )
    assert report["generated_by"] == "hybrid"
    assert meta["fallbacks"] == 1
    assert meta["details"]["compatibility"].startswith("unbacked_claim")
    assert report["compatibility"] == make_drafts()["compatibility"]


def test_notes_ground_their_own_numbers():
    drafts = make_drafts()
    notes = build_notes(METRICS, FACTS, drafts)
    by_label = dict(notes)
    assert {"80", "70"}.issubset(extract_numbers(by_label["COMPATIBILITY"]))
    assert "60" not in extract_numbers(by_label["COMPATIBILITY"])
    assert {"60"}.issubset(extract_numbers(by_label["PERFORMANCE"]))
    assert "50" in extract_numbers(by_label["ADVICE"])
    assert len(notes) == 4


def test_generate_without_llm_is_deterministic():
    report, meta = generate_why_matched(
        None, "Maria", "Barista", "Cafe X", METRICS, FACTS,
        explanations=EXPLANATIONS, overlap_skills=OVERLAP, accommodations=ACCOMMODATIONS,
    )
    drafts = make_drafts()
    assert report["compatibility"] == drafts["compatibility"]
    assert report["performance"] == drafts["performance"]
    assert report["advice"] == drafts["advice"]
    assert report["challenges"] == drafts["challenges"]
    assert report["barriers"] == FACTS["barriers"]
    assert report["generated_by"] == "deterministic"
    assert meta["fallbacks"] == 3


def test_generate_accepts_fully_grounded_output():
    llm = FakeLLM(grounded_responder)
    report, meta = generate_why_matched(
        llm, "Maria", "Barista", "Cafe X", METRICS, FACTS,
        explanations=EXPLANATIONS, overlap_skills=OVERLAP, accommodations=ACCOMMODATIONS,
    )
    assert report["generated_by"] == "llm"
    assert meta["fallbacks"] == 0
    assert "80 percent" in report["compatibility"]
    assert len(llm.calls) == 3  # one tiny call per section
    # challenges always carries the deterministic draft (never generated)
    assert report["challenges"] == make_drafts()["challenges"]


def test_generate_falls_back_only_on_bad_sections():
    def responder(messages):
        user = messages[-1]["content"]
        if "Workplace suitability" in user:
            return "You have a 99 percent chance of success here."  # hallucinated number
        return grounded_responder(messages)

    report, meta = generate_why_matched(
        FakeLLM(responder), "Maria", "Barista", "Cafe X", METRICS, FACTS,
        explanations=EXPLANATIONS, overlap_skills=OVERLAP, accommodations=ACCOMMODATIONS,
    )
    assert report["generated_by"] == "hybrid"
    assert meta["fallbacks"] == 1
    drafts = make_drafts()
    assert report["compatibility"] == drafts["compatibility"]  # fell back to plain draft
    assert "60 percent" in report["performance"]


def test_generate_never_raises_on_model_error():
    report, meta = generate_why_matched(
        FakeLLM(RuntimeError("boom")), "Maria", "Barista", "Cafe X", METRICS, FACTS,
        explanations=EXPLANATIONS, overlap_skills=OVERLAP, accommodations=ACCOMMODATIONS,
    )
    assert report["compatibility"] == make_drafts()["compatibility"]
    assert report["generated_by"] == "deterministic"
    assert meta["fallbacks"] == 3
    assert all("error" in str(v) for v in meta["details"].values())


def test_generate_handles_empty_output():
    report, meta = generate_why_matched(
        FakeLLM(""), "Maria", "Barista", "Cafe X", METRICS, FACTS,
        explanations=EXPLANATIONS, overlap_skills=OVERLAP, accommodations=ACCOMMODATIONS,
    )
    assert report["generated_by"] == "deterministic"
    assert meta["fallbacks"] == 3


def test_generate_handles_missing_llm_attributes():
    class Broken:
        pass  # no model_path attribute at all

    report, meta = generate_why_matched(
        Broken(), "Maria", "Barista", "Cafe X", METRICS, FACTS,
        explanations=EXPLANATIONS, overlap_skills=OVERLAP, accommodations=ACCOMMODATIONS,
    )
    assert report["generated_by"] == "deterministic"
    assert meta["fallbacks"] == 3


def test_llm_chat_wraps_the_shared_client():
    from why_matched import llm_chat

    llm = FakeLLM("Warm rewrite for you here. Keep going.")
    text, tokens = llm_chat(llm, [{"role": "user", "content": "hi"}], 20)
    assert text == "Warm rewrite for you here. Keep going."
    assert tokens == 33


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
