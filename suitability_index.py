"""
Workplace Suitability Index

How "workplace suitability" is defined and measured:

Definition
    Workplace suitability is the degree to which a workplace can genuinely
    accommodate a Person with Disability (PWD) candidate across four pillars,
    scored 0-100 each and combined into a weighted Suitability Index (0-100):

        1. Physical Accessibility  (BP 344 - Accessibility Law, 1982)
        2. Digital Accessibility   (RA 10524 - inclusive digital work systems)
        3. Policy Support          (RA 10524 - inclusive hiring & reasonable accommodations)
        4. Task Capability         (personalized: job demands vs the candidate's capability profile)

Measurement
    Each pillar is measured from evidence the employer provides at job posting:
    accessibility_features, work_environment, job_description, physical_requirements,
    benefits, remote_friendly, and has_flexibility. Task Capability reuses the
    capability-compatibility score produced by the matching engine.

Index = 0.25*Physical + 0.20*Digital + 0.20*Policy + 0.35*Task
    Weights emphasize Task Capability (most personalized) and Physical
    Accessibility (most legally mandated by BP 344).
"""

import re

WEIGHTS = {
    "physical": 0.25,
    "digital": 0.20,
    "policy": 0.20,
    "task": 0.35,
}

PILLAR_META = {
    "physical": {
        "label": "Physical Accessibility",
        "legal_basis": "BP 344 (Accessibility Law) - physical environment features such as ramps, elevators, accessible parking, restrooms, and signage",
    },
    "digital": {
        "label": "Digital Accessibility",
        "legal_basis": "RA 10524 - accessible digital systems: assistive tech, screen-reader-friendly tools, captions, and remote-capable work",
    },
    "policy": {
        "label": "Policy Support",
        "legal_basis": "RA 10524 - inclusive hiring policies, reasonable accommodations, and anti-discrimination commitments",
    },
    "task": {
        "label": "Task Capability",
        "legal_basis": "Personalized capability matching - the job's demands compared against your stated capability profile",
    },
}

DEFINITION = (
    "Workplace Suitability measures how well a workplace can genuinely accommodate "
    "you as a PWD candidate, based on four pillars: Physical Accessibility (BP 344), "
    "Digital Accessibility (RA 10524), Policy Support (RA 10524), and Task Capability "
    "(how well the job's demands fit your capability profile). Each pillar scores "
    "0-100; the Suitability Index is their weighted average. Weights: "
    "Physical 25%, Digital 20%, Policy 20%, Task 35%."
)

# Single words are matched on word boundaries ("lift" must not match "lifting").
PHYSICAL_ELEMENTS = [
    "ramp", "elevator", "lift", "parking", "restroom", "toilet", "braille",
    "signage", "doorway", "handrail", "tactile", "wheelchair", "ergonomic",
    "cubicle", "desk",
]

PHYSICAL_PHRASES = [
    "accessible parking", "accessible restroom", "level floor", "automatic door",
    "quiet zone", "accessible entrance", "grab bar", "accessible toilet",
]

DIGITAL_ELEMENTS = [
    "screen reader", "assistive tech", "assistive technology", "caption",
    "voice command", "adaptive", "transcription",
]

DIGITAL_PHRASES = [
    "accessible software", "digital tool", "online platform", "accessible document",
    "accessible system", "video call", "remote software", "accessible app",
]

# (term, word_boundary_only)
POLICY_TERMS = [
    ("inclusive", True),
    ("accommodation", False),
    ("equal opportunity", False),
    ("non-discriminat", False),
    ("quota", False),
    ("no discrimination", False),
    ("equal employ", False),
    ("pwd", True),
    ("dole", True),
    ("pdao", False),
    ("disability", False),
    ("person with disabilit", False),
]

NEUTRAL = {
    "physical": (30.0, "No physical accessibility features were stated by the employer. Treat this as unverified - ask the employer about ramps, elevators, and accessible restrooms (BP 344)."),
    "digital": (30.0, "No digital accessibility features were stated. Verify that workplace tools are screen-reader friendly and keyboard-navigable (RA 10524)."),
    "policy": (50.0, "No inclusive hiring policy was stated. Ask the employer about reasonable accommodations and anti-discrimination commitments (RA 10524)."),
}


def _job_text(job):
    return " ".join([
        str(job.get("accessibility_features") or ""),
        str(job.get("job_description") or ""),
        str(job.get("physical_requirements") or ""),
        str(job.get("work_environment") or ""),
        str(job.get("benefits") or ""),
    ]).lower()


def _find_words(text, words):
    return [w for w in words if re.search(rf"\b{re.escape(w)}s?\b", text)]


def _find_phrases(text, phrases):
    return [p for p in phrases if p in text]


def _score_physical(job, text):
    if job.get("remote_friendly"):
        return 100.0, ["Fully remote role - no physical workplace access needed, so BP 344 physical features are not required."]
    found = _find_words(text, PHYSICAL_ELEMENTS) + _find_phrases(text, PHYSICAL_PHRASES)
    if not found:
        return NEUTRAL["physical"]
    score = min(100.0, 20.0 * len(found))
    return score, [f"Employer states: {', '.join(dict.fromkeys(found))} (BP 344 elements)"]


def _score_digital(job, text):
    if job.get("remote_friendly"):
        return 100.0, ["Fully remote role - digital tools are the primary work environment (RA 10524)"]
    base = 30.0
    evidence = []
    if job.get("has_flexibility"):
        base += 40.0
        evidence.append("Job supports flexible work, reducing reliance on fixed on-site systems")
    found = _find_words(text, DIGITAL_ELEMENTS) + _find_phrases(text, DIGITAL_PHRASES)
    if found:
        base += 20.0 * min(2, len(found))
        evidence.append("Employer states: " + ", ".join(dict.fromkeys(found)))
    if not found and not evidence:
        return NEUTRAL["digital"]
    if not found:
        evidence.append("No specific digital tools stated - verify screen-reader compatibility and captions (RA 10524)")
    return min(100.0, base), evidence


def _score_policy(job, text):
    found = []
    for term, boundary in POLICY_TERMS:
        if boundary:
            if re.search(rf"\b{re.escape(term)}s?\b", text):
                found.append(term)
        elif term in text:
            found.append(term)
    if not found:
        return NEUTRAL["policy"]
    score = 50.0 + 12.5 * min(4, len(found))
    return min(100.0, score), ["Employer signals: " + ", ".join(dict.fromkeys(found)) + " (RA 10524)"]


def _score_task(compat_score):
    return compat_score, ["Reuses the capability-compatibility score: the job's demands vs your capability profile, measured in the matching engine."]


def compute_suitability_index(job, compat_score):
    """Return the Workplace Suitability Index for a job against a compat score."""
    text = _job_text(job)
    tasks = {
        "physical": _score_physical,
        "digital": _score_digital,
        "policy": _score_policy,
        "task": _score_task,
    }
    pillars = []
    for key, fn in tasks.items():
        score, evidence = fn(job, text) if key != "task" else _score_task(compat_score)
        pillars.append({
            "key": key,
            "label": PILLAR_META[key]["label"],
            "legal_basis": PILLAR_META[key]["legal_basis"],
            "weight": WEIGHTS[key],
            "score": round(score, 1),
            "evidence": evidence,
        })
    index = round(sum(p["score"] * p["weight"] for p in pillars), 1)
    return {
        "index": index,
        "definition": DEFINITION,
        "weights": WEIGHTS,
        "pillars": pillars,
    }
