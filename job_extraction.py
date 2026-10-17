# ==========================================
# job_extraction.py — Job-description feature extraction via the local GGUF
# ==========================================
# Single-generative-model design (auditable for the thesis): the local
# Qwen2.5 GGUF from why_matched.py is the ONLY generative AI in the project.
# It replaces the former Flan-T5 engine for the two posting-time extraction
# paths:
#
#   1. extract_job_features()     -> task intensity / schedule flexibility /
#      skills, used by generate_job_embedding() when a job record has no
#      structured data (and by reindex_jobs.py).
#   2. extract_posting_features() -> skills / posture / communication / pace
#      tags for the employer posting assistant
#      (/api/employer/ai-analyze-description).
#
# Both callers keep their deterministic defaults, so when no GGUF model is
# available the features degrade gracefully (no request ever fails because
# of the model).  All calls go through why_matched.llm_chat(), which
# serializes access to the single shared Llama instance.

import re

from why_matched import llm_chat

_FEATURE_MAX_TOKENS = 120
_POSTING_MAX_TOKENS = 160

_FEATURE_SYSTEM = (
    "You extract facts from job descriptions. "
    "Reply with exactly one line in the requested format and nothing else."
)
_POSTING_SYSTEM = (
    "You extract facts from job postings. "
    "Reply with exactly one line in the requested format and nothing else."
)

_FEATURE_FORMAT = (
    "Intensity: [Low|Medium|High], Flexibility: [Yes|No], "
    "Skills: [comma separated list]"
)
_POSTING_FORMAT = (
    "Skills: [comma separated skills] | Posture: [posture] | "
    "Communication: [mode] | Pace: [pace]"
)

_POSTING_LABELS = ("Skills", "Posture", "Communication", "Pace")
_FEATURE_LABELS = ("Intensity", "Flexibility", "Skills")


def build_feature_messages(job_description, physical_requirements=""):
    """Chat messages asking for intensity / flexibility / skills."""
    context = " ".join(x for x in (job_description, physical_requirements) if x).strip()
    return [
        {"role": "system", "content": _FEATURE_SYSTEM},
        {
            "role": "user",
            "content": (
                f"Context: {context}\n"
                "Question: What is the task intensity (Low, Medium, High)? "
                "Does it offer schedule flexibility (Yes, No)? "
                "List the professional skills.\n"
                f"Answer format: {_FEATURE_FORMAT}"
            ),
        },
    ]


def build_posting_messages(job_title, description):
    """Chat messages asking for skills / posture / communication / pace."""
    return [
        {"role": "system", "content": _POSTING_SYSTEM},
        {
            "role": "user",
            "content": (
                f"Context: Job title: {job_title}. Description: {description}.\n"
                "Question: 1. Extract 3 to 6 key professional skills. "
                "2. What is the physical posture (Mostly Seated, Mixed Standing, Physical Handling)? "
                "3. What is the communication mode (Text-First, Phone/Spoken, Mixed)? "
                "4. What is the work pace (Self-Paced, Standard, Fast-Paced)?\n"
                f"Answer format: {_POSTING_FORMAT}"
            ),
        },
    ]


def _split_labeled(text, labels):
    """Split a one-line reply into {label: value} pairs — order independent.

    Tolerates pipes, commas, extra text after a newline, and repeated labels
    (first occurrence wins).  Values stop at the next known label.
    """
    pattern = "(" + "|".join(re.escape(l) for l in labels) + "):"
    parts = re.split(pattern, text or "", flags=re.IGNORECASE)
    values = {}
    for i in range(1, len(parts) - 1, 2):
        label = parts[i].lower()
        value = re.split(r"[|\n]", parts[i + 1])[0].strip().rstrip(",.; ")
        if label not in values:
            values[label] = value
    return values


def parse_feature_reply(text):
    """Parse an intensity/flexibility/skills reply into normalized values."""
    values = _split_labeled(text, _FEATURE_LABELS)

    intensity = None
    if values.get("intensity", "").lower() in ("low", "medium", "high"):
        intensity = values["intensity"].capitalize()

    flexibility = 1 if values.get("flexibility", "").lower() == "yes" else 0

    return {
        "intensity": intensity,
        "flexibility": flexibility,
        "skills": values.get("skills", ""),
    }


def parse_posting_reply(text):
    """Parse a skills/posture/communication/pace reply into normalized values."""
    values = _split_labeled(text, _POSTING_LABELS)

    skills_txt = values.get("skills", "")
    skills = [s.strip() for s in skills_txt.split(",") if s.strip() and ":" not in s]

    return {
        "skills": skills,
        "posture": values.get("posture") or "Mostly Seated",
        "communication": values.get("communication") or "Mixed",
        "pace": values.get("pace") or "Standard",
    }


def extract_job_features(llm, job_description, physical_requirements=""):
    """Intensity / flexibility / skills for one job description.

    Raises RuntimeError when no local LLM is loaded so callers can keep
    their deterministic defaults.
    """
    if llm is None:
        raise RuntimeError("local LLM (Qwen GGUF) unavailable")
    reply, _tokens = llm_chat(
        llm,
        build_feature_messages(job_description, physical_requirements),
        _FEATURE_MAX_TOKENS,
        temperature=0.0,
    )
    return parse_feature_reply(reply)


def extract_posting_features(llm, job_title, description):
    """Skills / posture / communication / pace tags for an employer posting.

    Raises RuntimeError when no local LLM is loaded so callers can keep
    their deterministic defaults.
    """
    if llm is None:
        raise RuntimeError("local LLM (Qwen GGUF) unavailable")
    reply, _tokens = llm_chat(
        llm, build_posting_messages(job_title, description), _POSTING_MAX_TOKENS, temperature=0.0
    )
    return parse_posting_reply(reply)
