# ==========================================
# why_matched.py — Grounded plain-language verbalizer for "Why matched?"
# ==========================================
# Design principles (auditable for the thesis):
#
# 1. SINGLE SOURCE OF TRUTH.  The deterministic compatibility engine
#    (compatibility_engine.py) already knows *why* a job matches — dimension
#    by dimension, with verdicts.  This module never lets the language model
#    discover or judge facts.
#
# 2. DETERMINISTIC PLAIN-LANGUAGE FIRST.  compose_plain_drafts() builds the
#    three dashboard cards from fixed sentence templates over the engine's
#    verified verdicts.  This layer is instant, accurate, and already simple
#    enough for PWD/older readers — the system works fully without any model.
#
# 3. GUARDED LLM SOFTENER (optional).  If a local GGUF model is available it
#    may rewrite each draft into warmer phrasing.  Every rewrite passes a
#    deterministic verification guard (numbers AND evaluative claim words
#    must already exist in the note, copied expert chunks and degenerate
#    text are rejected); on any failure THAT section falls back to the
#    deterministic draft.  The feature can never display an ungrounded
#    explanation.
#
# 4. RELIABLE ON WEAK CPU.  One tiny focused call per section (≈35 output
#    tokens), and callers cache results (DB cache + pre-warm), so panelists
#    never wait for generation.
#
# 5. SHARED LOCAL-LLM RUNTIME.  load_llm() / llm_chat() / find_local_model()
#    form the project's SINGLE local-LLM access point: the same GGUF model
#    also powers job-description feature extraction (job_extraction.py).
#    Every call is serialized through one lock — one model, one copy in
#    memory, no Flan-T5 or other generative engines alongside it.

import os
import re
import threading
import time

# Report keys keep the exact names the dashboard already renders.
SECTION_KEYS = ("compatibility", "performance", "advice", "challenges")

# Sections the LLM may soften.  "challenges" is intentionally NOT generated:
# the dashboard surfaces cons_summary (always present) and skipping it saves
# ~25% of generation time on weak CPUs.
_SOFTENED_SECTIONS = ("compatibility", "performance", "advice")

_MAX_TOKENS_PER_SECTION = 90

_SECTION_SYSTEM = (
    "You rewrite one simple note into even warmer, friendly English for a "
    "person with disability or an older worker. Keep two short sentences. "
    "Do not change the meaning. Do not copy the note. Use only the facts in "
    "the note. Keep every number exactly as written. Talk to the reader as "
    "'you'. Be kind and encouraging. Do not exaggerate: avoid boosting words "
    "(great, excellent, perfect, amazing, very, always, best) unless the note "
    "itself uses them."
)

_LABEL_PREFIX_RE = re.compile(r"^\s*(COMPATIBILITY|PERFORMANCE|ADVICE|WATCH)\s*:\s*", re.IGNORECASE)
_NUMBER_RE = re.compile(r"\d+(?:\.\d+)?")

_BANNED_FRAGMENTS = (
    "person with",
    "as an ai",
    "i cannot",
    "i'm sorry",
    "language model",
    "http://",
    "https://",
    "rewritten version",
)

# Evaluative vocabulary that asserts a level, capability or experience the
# verified note never granted.  The note is built exclusively from engine
# verdicts, so a rewrite may use one of these words ONLY if the note itself
# already contains it (e.g. "easy" is allowed when the draft says "These
# parts are easy for you").  This closes the "embellishment" hole observed in
# bake-off runs: the softener must not upgrade "your skills fit part of this
# job" into "you're great at this".
_CLAIM_WORDS = (
    "able", "absolutely", "always", "amazing", "awesome", "best", "brilliant",
    "capable", "certainly", "completely", "confident", "confidently", "crucial",
    "definitely", "easier", "easily", "easy", "enjoy", "enjoyed", "enjoys",
    "essential", "excel", "excels", "excellent", "exceptional", "expert",
    "expertise", "extraordinary", "extremely", "fantastic", "flawless", "great",
    "greatest", "guarantee", "guaranteed", "highly", "ideal", "impressive",
    "incredible", "incredibly", "love", "loved", "loves", "marvelous", "master",
    "mastered", "never", "outstanding", "perfect", "perfectly", "really",
    "remarkable", "strong", "succeed", "success", "successful", "super",
    "superb", "terrific", "thrive", "thrives", "totally", "tremendous",
    "truly", "valuable", "very", "vital", "wonderful",
)

# The reader is addressed as "you" only: any first-person voice means the
# model slipped into assistant/employer chatter (observed in zero-shot runs),
# and the section must fall back to the deterministic draft.
_FIRST_PERSON_RE = re.compile(r"\b(i|i'm|i've|my|we|we'd|we'll|we're|our|us)\b", re.IGNORECASE)

_MIN_LEN = 30
_MAX_LEN = 800
_COPY_WINDOW = 10  # verbatim word-window that counts as "copied from the note"


def _canon_number(raw):
    """'70.0' -> '70', '70.50' -> '70.5', '70' -> '70'."""
    try:
        f = float(raw)
        if f.is_integer():
            return str(int(f))
        return "%g" % f
    except ValueError:
        return raw


def extract_numbers(text):
    return {_canon_number(m) for m in _NUMBER_RE.findall(text or "")}


def _unbacked_claims(text, source_note):
    """Claim words present in a rewrite but absent from its verified note.

    The note contains only engine-grounded sentences, so any evaluative word
    it does not itself use (e.g. "great", "very", "always", "enjoy") is an
    embellishment the underlying data never granted.
    """
    note_words = set(re.findall(r"[a-z]+", (source_note or "").lower()))
    text_words = set(re.findall(r"[a-z]+", (text or "").lower()))
    return sorted(w for w in _CLAIM_WORDS if w in text_words and w not in note_words)


def _strip_visuals(text):
    """Remove emoji/symbol icons so the model never echoes decoration."""
    cleaned = re.sub(r"[\u2190-\u2BFF\uFE0F\U0001F000-\U0001FAFF]", " ", text or "")
    return re.sub(r"\s+", " ", cleaned).strip()


def _dim_phrase(ex):
    return str(ex.get("dimension") or ex.get("dimension_key") or "the work").lower()


def compose_plain_drafts(metrics, facts, explanations=None, overlap_skills=None, accommodations=None):
    """Deterministic, very simple drafts for the three "Why matched?" cards.

    Every sentence is built from verified engine verdicts (per-dimension
    match / marginal / mismatch) and the capability-derived accommodation
    list.  No model is involved, so this layer is instant and cannot drift.
    """
    exs = [e for e in (explanations or []) if isinstance(e, dict)]
    mismatches = [e for e in exs if e.get("verdict") == "mismatch"]
    marginals = [e for e in exs if e.get("verdict") == "marginal"]
    goods = [e for e in exs if e.get("verdict") == "match"]
    acc = [str(a).strip() for a in (accommodations or []) if str(a).strip()]

    # --- COMPATIBILITY: can this job safely fit the person?
    c = []
    if mismatches:
        c.append(f"This job fits you only partly. It asks for more {_dim_phrase(mismatches[0])} than you are comfortable with.")
        if len(mismatches) > 1:
            c.append(f"It also asks a lot of {_dim_phrase(mismatches[1])}.")
        c.append("You would need support from the employer to do this job safely.")
    elif marginals:
        c.append(f"This job is close to your comfort level. Its {_dim_phrase(marginals[0])} needs are a little higher than you prefer.")
        c.append("With small changes at work, it can still fit you well.")
    else:
        c.append("This job fits your comfort level well. Nothing here is a big problem for you.")
    if goods:
        good_names = " and ".join(_dim_phrase(e) for e in goods[:2])
        c.append(f"These parts work well for you already: {good_names}.")
    compatibility = " ".join(c)

    # --- PERFORMANCE: what the person can already do
    p = []
    skills = [str(s).strip() for s in (overlap_skills or []) if str(s).strip()]
    if skills:
        p.append(f"Your skills already fit part of this job: {', '.join(skills[:3])}.")
    if goods:
        good_names = " and ".join(_dim_phrase(e) for e in goods[:2])
        p.append(f"These parts are easy for you: {good_names}.")
    if mismatches:
        p.append(f"The {_dim_phrase(mismatches[0])} parts may be hard, so plan rest and support for those days.")
    if not p:
        p.append(_strip_visuals(facts.get("performance", "")) or "Your skills give a workable base for this job.")
    performance = " ".join(p[:3])

    # --- ADVICE: what to ask the employer for
    if acc:
        advice = "Ask the employer for these changes: " + ", ".join(acc[:4]) + ". These can make the work easier and safer for you."
    else:
        advice = _strip_visuals(facts.get("advice", "")) or "Ask the employer about changes that can make the work easier for you."

    return {
        "compatibility": compatibility,
        "performance": performance,
        "advice": advice,
        "challenges": _strip_visuals(facts.get("hinder", "")) or "No significant barriers were found.",
    }


def build_notes(metrics, facts, drafts):
    """Wrap each draft into a note for the LLM, including its own metric line.

    Returns a list of (label, note_text).  Every number the softened rewrite
    may legally mention exists inside that section's own note.
    """
    safety = float(metrics.get("safety", 100.0))
    skills = float(metrics.get("skills", 100.0))
    stamina = float(metrics.get("stamina", 100.0))
    ontology = float(metrics.get("ontology", 100.0))

    return [
        (
            "COMPATIBILITY",
            f"Workplace suitability is {ontology:.0f} percent. "
            f"Physical safety alignment is {safety:.0f} percent. "
            f"{drafts['compatibility']}".strip(),
        ),
        (
            "PERFORMANCE",
            f"Technical skill relevance is {skills:.0f} percent. "
            f"{drafts['performance']}".strip(),
        ),
        (
            "ADVICE",
            f"Stamina compatibility is {stamina:.0f} percent. "
            f"{drafts['advice']}".strip(),
        ),
        (
            "WATCH",
            f"{drafts['challenges']}".strip(),
        ),
    ]


def _section_messages(note_text):
    """One tiny self-contained soften task per section (reliable on 1-2B models)."""
    return [
        {"role": "system", "content": _SECTION_SYSTEM},
        {"role": "user", "content": f"Note: {note_text}\n\nRewrite this note simply and warmly:"},
    ]


def _copies_note(section_text, source_note, window=_COPY_WINDOW):
    """True when the rewrite contains a verbatim chunk copied from the note."""
    def norm_words(t):
        return re.sub(r"[^a-z0-9%\s]", " ", t.lower()).split()

    src_words = norm_words(source_note)
    out_words = norm_words(section_text)
    if len(src_words) < window or len(out_words) < window:
        return False
    src_windows = {" ".join(src_words[i:i + window]) for i in range(len(src_words) - window + 1)}
    for i in range(len(out_words) - window + 1):
        if " ".join(out_words[i:i + window]) in src_windows:
            return True
    return False


def verify_section(section_text, source_note):
    """Deterministic grounding check for one softened section.

    Returns (ok, reason).  A section is accepted only if:
      - it is not empty / not rambling / not truncated
      - it contains no banned degenerate fragments
      - every number it mentions already exists in the source note
      - it uses no evaluative claim word the note itself does not use
      - it is a real rewrite, not a verbatim copy of the note
    """
    if not section_text:
        return False, "empty"
    if len(section_text) < _MIN_LEN:
        return False, "too_short"
    if len(section_text) > _MAX_LEN:
        return False, "too_long"
    if section_text[-1] not in ".!?\"')":
        return False, "looks_truncated"

    low = section_text.lower()
    for frag in _BANNED_FRAGMENTS:
        if frag in low:
            return False, f"banned:{frag}"

    fp = _FIRST_PERSON_RE.search(low)
    if fp:
        return False, f"first_person:{fp.group(0)}"

    ungrounded = extract_numbers(section_text) - extract_numbers(source_note)
    if ungrounded:
        return False, f"ungrounded_numbers:{sorted(ungrounded)}"

    claims = _unbacked_claims(section_text, source_note)
    if claims:
        return False, f"unbacked_claim:{','.join(claims)}"

    if _copies_note(section_text, source_note):
        return False, "copied_note_text"

    return True, "ok"


def generate_why_matched(llm, name, job_title, employer, metrics, facts,
                         explanations=None, overlap_skills=None, accommodations=None):
    """Produce the "Why matched?" sections.

    The deterministic drafts are computed first and are always available; the
    LLM may soften any section that passes the verification guard.  Returns
    (report_dict, meta_dict).  Never raises.
    """
    drafts = compose_plain_drafts(
        metrics, facts,
        explanations=explanations,
        overlap_skills=overlap_skills,
        accommodations=accommodations,
    )
    notes = build_notes(metrics, facts, drafts)
    note_by_key = dict(zip(SECTION_KEYS, [n[1] for n in notes]))

    report = {
        "compatibility": drafts["compatibility"],
        "performance": drafts["performance"],
        "advice": drafts["advice"],
        "challenges": drafts["challenges"],
        "barriers": facts.get("barriers", []),
        "generated_by": "deterministic",
    }
    meta = {
        "model": "none",
        "seconds": 0.0,
        "tokens": 0,
        "tok_per_s": 0.0,
        "fallbacks": len(_SOFTENED_SECTIONS),
        "details": {},
        "timings": {},
    }
    if llm is None:
        return report, meta

    details = {}
    timings = {}
    tokens = 0
    accepted = 0

    for key in _SOFTENED_SECTIONS:
        try:
            t0 = time.perf_counter()
            raw, used_tokens = llm_chat(
                llm,
                _section_messages(note_by_key[key]),
                _MAX_TOKENS_PER_SECTION,
                temperature=0.0,
                repeat_penalty=1.1,
            )
            timings[key] = round(time.perf_counter() - t0, 2)
            tokens += used_tokens
            candidate = _LABEL_PREFIX_RE.sub("", raw).strip()
            ok, reason = verify_section(candidate, note_by_key[key])
            details[key] = reason
            if ok:
                report[key] = candidate
                accepted += 1
        except Exception as e:  # one bad section must never kill the report
            details[key] = f"error:{e}"
            timings.setdefault(key, 0.0)

    total_seconds = round(sum(timings.values()), 2)
    report["generated_by"] = "llm" if accepted == len(_SOFTENED_SECTIONS) else (
        "hybrid" if accepted else "deterministic"
    )
    meta = {
        "model": getattr(llm, "model_path", "llm"),
        "seconds": total_seconds,
        "tokens": tokens,
        "tok_per_s": round(tokens / total_seconds, 1) if total_seconds > 0 and tokens else 0.0,
        "fallbacks": len(_SOFTENED_SECTIONS) - accepted,
        "details": details,
        "timings": timings,
    }
    return report, meta


# ==========================================
# SHARED LOCAL-LLM RUNTIME (single generative model for the whole project)
# ==========================================
# The same GGUF instance is used by the "Why matched?" softener and by
# job-description feature extraction (job_extraction.py).  llama-cpp is NOT
# safe for concurrent calls on one instance, so every call is serialized
# through LLM_LOCK.

LLM_LOCK = threading.Lock()

_PREFERRED_MODELS = (
    "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
    "Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    "Qwen3.5-0.8B-Q4_K_M.gguf",
)
_DEFAULT_MODEL_DIR = os.path.join("model_cache", "gguf")


def find_local_model(models_dir=None):
    """Locate the preferred local GGUF weights (env override honoured).

    Walks the model directory once, keeps every preferred file found, then
    picks the winner by preference order (os.walk order is alphabetical).
    Returns a path, or "" when nothing is available.
    """
    env = os.getenv("WHY_MATCHED_MODEL", "")
    if env:
        return env
    base = models_dir or _DEFAULT_MODEL_DIR
    found = {}
    for root, _dirs, files in os.walk(base):
        for f in files:
            if f in _PREFERRED_MODELS and f not in found:
                found[f] = os.path.join(root, f)
    for name in _PREFERRED_MODELS:
        if name in found:
            return found[name]
    return ""


def llm_chat(llm, messages, max_tokens, **params):
    """Thread-safe one-shot chat call on the shared local GGUF model.

    Returns (text, completion_tokens).  Serialized via LLM_LOCK because the
    whole application shares ONE Llama instance (why-matched rewrites +
    job-description extraction).
    """
    with LLM_LOCK:
        resp = llm.create_chat_completion(messages=messages, max_tokens=max_tokens, **params)
    text = (resp["choices"][0]["message"]["content"] or "").strip()
    tokens = int(resp.get("usage", {}).get("completion_tokens", 0) or 0)
    return text, tokens


def load_llm(model_path, n_ctx=2048, n_threads=2, verbose=False):
    """Load a GGUF model through llama-cpp-python.

    Raises ImportError when llama-cpp-python is not installed and
    FileNotFoundError when the weights are missing — callers decide fallback.
    """
    from llama_cpp import Llama

    if not os.path.isfile(model_path):
        raise FileNotFoundError(f"GGUF model not found: {model_path}")

    return Llama(
        model_path=model_path,
        n_ctx=n_ctx,
        n_threads=n_threads,
        verbose=verbose,
    )
