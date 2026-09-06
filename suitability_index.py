"""
Workplace Suitability Index
============================
Aligned with NCDA Administrative Order No. 001, Series of 2021,
and the International Classification of Functioning, Disability
and Health (ICF) framework for work capability assessment.

How "workplace suitability" is defined and measured:

Definition
    Workplace suitability is the degree to which a workplace can genuinely
    accommodate a Person with Disability (PWD) candidate across four pillars,
    scored 0-100 each and combined into a weighted Suitability Index (0-100):

        1. Physical Accessibility  (BP 344 - Accessibility Law, 1982)
        2. Digital Accessibility   (RA 10524 - inclusive digital work systems)
        3. Policy Support          (RA 10524 - inclusive hiring & reasonable accommodations)
        4. Task Capability         (personalized: job demands vs the candidate's capability profile)

    Each pillar maps to ICF components:
        Physical  -> ICF Body Functions (b7xx musculoskeletal, b2xx sensory)
        Digital   -> ICF Environmental Factors (e1xx products/technology)
        Policy    -> ICF Environmental Factors (e3xx support/relationships, e5xx services)
        Task      -> ICF Activities and Participation (d8xx work, d2xx tasks)

Measurement
    Each pillar is measured from evidence the employer provides at job posting:
    accessibility_features, work_environment, job_description, physical_requirements,
    benefits, remote_friendly, and has_flexibility. Task Capability reuses the
    capability-compatibility score produced by the matching engine.

Index = 0.25*Physical + 0.20*Digital + 0.20*Policy + 0.35*Task
    Weights emphasize Task Capability (most personalized) and Physical
    Accessibility (most legally mandated by BP 344).

Regulatory Alignment:
    - BP 344 (Accessibility Law of 1982) - Physical accessibility mandates
    - RA 10524 (Equal Opportunity Employment for PWDs) - Digital and policy
    - NCDA AO No. 001 s.2021 - PWD ID issuance and disability classification
    - ICF (WHO, 2001) - International standard for functioning assessment
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
        "icf_component": "Body Functions",
        "icf_codes": ["b710", "b730", "b760", "d450", "d460"],
        "icf_description": "ICF: Musculoskeletal functions (b7xx) and mobility (d4xx) - assessing physical access to the work environment",
    },
    "digital": {
        "label": "Digital Accessibility",
        "legal_basis": "RA 10524 - accessible digital systems: assistive tech, screen-reader-friendly tools, captions, and remote-capable work",
        "icf_component": "Environmental Factors",
        "icf_codes": ["e110", "e115", "e120"],
        "icf_description": "ICF: Products and technology (e1xx) - assessing availability of assistive digital tools and accessible software",
    },
    "policy": {
        "label": "Policy Support",
        "legal_basis": "RA 10524 - inclusive hiring policies, reasonable accommodations, and anti-discrimination commitments",
        "icf_component": "Environmental Factors",
        "icf_codes": ["e310", "e320", "e510", "e520"],
        "icf_description": "ICF: Support and relationships (e3xx), Services/systems/policies (e5xx) - assessing institutional support structures",
    },
    "task": {
        "label": "Task Capability",
        "legal_basis": "Personalized capability matching - the job demands compared against your capability profile (ICF Activities and Participation)",
        "icf_component": "Activities and Participation",
        "icf_codes": ["d810", "d820", "d840", "d850", "d210", "d220"],
        "icf_description": "ICF: Work and employment (d8xx), Tasks and demands (d2xx) - assessing functional capacity for job tasks",
    },
}

DEFINITION = (
    "Workplace Suitability measures how well a workplace can genuinely accommodate "
    "you as a PWD candidate, based on four pillars aligned with the ICF framework: "
    "Physical Accessibility (BP 344; ICF Body Functions b7xx, d4xx), "
    "Digital Accessibility (RA 10524; ICF Environmental Factors e1xx), "
    "Policy Support (RA 10524; ICF Environmental Factors e3xx, e5xx), and "
    "Task Capability (ICF Activities and Participation d8xx). "
    "Each pillar scores 0-100; the Suitability Index is their weighted average. "
    "Weights: Physical 25%, Digital 20%, Policy 20%, Task 35%. "
    "Disability categories follow NCDA AO No. 001 s.2021 (RA 9442, 10754, 11215, 10747)."
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
    """Return the Workplace Suitability Index for a job against a compat score.
    
    Aligned with NCDA AO No. 001 s.2021 and ICF framework.
    Returns index, pillar breakdowns with ICF references, and regulatory metadata.
    """
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
        meta = PILLAR_META[key]
        pillars.append({
            "key": key,
            "label": meta["label"],
            "legal_basis": meta["legal_basis"],
            "icf_component": meta["icf_component"],
            "icf_codes": meta["icf_codes"],
            "icf_description": meta["icf_description"],
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
        "regulatory_alignment": {
            "ncda_ao": "NCDA Administrative Order No. 001, Series of 2021",
            "ncda_legal_basis": "Republic Acts 9442, 10754, 11215, 10747",
            "icf_framework": "WHO International Classification of Functioning, Disability and Health (2001)",
            "bp_344": "Batas Pambansa Blg. 344 - Accessibility Law (1982)",
            "ra_10524": "Republic Act No. 10524 - Equal Opportunity Employment for PWDs",
        },
    }
