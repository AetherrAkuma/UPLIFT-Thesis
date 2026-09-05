"""
UPLIFT Compatibility Engine
===========================
Replaces EXPERT_KNOWLEDGE and the coarse category-branching ontology.

Core principle: MATCHING READS FUNCTIONAL CAPABILITIES, NEVER DISABILITY LABELS.
The disability hierarchy (Category > Subtype > Extent) is used only to SUGGEST
a capability profile; scoring compares capability levels against job demand
levels dimension-by-dimension and produces factual, auditable reasons.

This structurally eliminates the "finger amputee vs whole-arm amputee" bias:
both are reduced to capability levels, and only the levels gate matching.
"""
import json
import re
import numpy as np

# ---------------------------------------------------------------------------
# Dimension vocabulary (shared between users and jobs)
# ---------------------------------------------------------------------------
LEVEL_RANK = {"Low": 1, "Medium": 2, "High": 3}
DEFAULT_LEVEL = "Medium"

# User capability vocabulary (Low/Medium/High) is unified with the job demand
# vocabulary (Relaxed/Moderate/High) so a user's "Low" is never silently
# re-ranked to "Medium" — that produced dishonest "within your capability" claims.
TEMPO_RANK = {"Low": 1, "Relaxed": 1, "Medium": 2, "Moderate": 2, "High": 3}
SOCIAL_RANK = {"Low": 1, "Moderate": 2, "Medium": 2, "High": 3}

DIMENSION_LABELS = {
    "fine_motor": "fine-motor dexterity",
    "physical": "physical exertion (lifting/standing/walking)",
    "cognitive": "cognitive load",
    "sensory": "sensory stimulation",
    "social": "social interaction",
    "visual": "visual demand",
    "auditory": "auditory demand",
    "tempo": "work tempo",
    "intensity": "task intensity",
}

# Plain-language equivalents so the UI can explain findings in human words,
# with the underlying data as supporting detail rather than the headline.
DIMENSION_PLAIN = {
    "fine_motor": "fine-motor coordination and manual dexterity",
    "physical": "physical mobility and exertion",
    "cognitive": "cognitive and analytical tasks",
    "sensory": "environmental sensory comfort (lighting and sound)",
    "social": "interpersonal and team communication",
    "visual": "visual acuity and screen focus",
    "auditory": "auditory comprehension",
    "tempo": "work pace and operational tempo",
    "intensity": "concurrent task intensity",
}

LEVEL_PLAIN = {"Low": "light", "Relaxed": "relaxed", "Medium": "moderate", "Moderate": "moderate", "High": "high"}

# ---------------------------------------------------------------------------
# Subtype -> Extent -> Capability preset (+ recommended accommodations)
# ---------------------------------------------------------------------------
def _cap(fine="Medium", physical="Medium", cognitive="Medium", sensory="Medium",
         social="Moderate", visual="Medium", auditory="Medium", energy="Medium",
         intensity="Medium", acc=()):
    return {
        "fine_motor": fine, "physical": physical, "cognitive": cognitive,
        "sensory": sensory, "social": social, "visual": visual,
        "auditory": auditory, "energy": energy, "preferred_intensity": intensity,
        "accommodations": list(acc),
    }

# Category -> Subtype -> {extents or preset}. Extent-specific entries fall back
# to the subtype default when the user did not specify an extent.
CAPABILITY_PRESETS = {
    "Physical": {
        "Wheelchair User": _cap(
            fine="Medium", physical="Low", energy="Low", intensity="Low",
            acc=["Wheelchair-accessible office", "Level floor access", "Accessible parking",
                 "Adjustable-height desk", "Automatic doors"]),
        "Amputee": {
            "Finger(s)": _cap(
                fine="High", physical="Medium", energy="Medium",
                acc=["Ergonomic keyboard", "Wrist support", "Adaptive mouse"]),
            "Hand": _cap(
                fine="Low", physical="Medium",
                acc=["One-hand keyboard", "Voice input (Dragon/TalkBack)",
                     "Speech-to-text software", "Foot pedal mouse"]),
            "Forearm": _cap(
                fine="Low", physical="Low",
                acc=["One-hand keyboard", "Voice input", "Prosthetic support", "Ergonomic setup"]),
            "Upper Arm": _cap(
                fine="Low", physical="Low",
                acc=["Voice input", "Head-tracking pointer", "Speech-to-text software",
                     "Prosthetic support"]),
            "Leg(s)": _cap(
                fine="Medium", physical="Low", energy="Low",
                acc=["Wheelchair-accessible office", "Seated workstation", "Accessible restrooms"]),
            "Toe(s)": _cap(
                fine="Medium", physical="Medium",
                acc=["Adjustable-height desk", "Custom foot support"]),
            "Other": _cap(fine="Medium", physical="Low", energy="Low"),
        },
        "Cerebral Palsy": _cap(
            fine="Medium", physical="Low", energy="Low",
            acc=["Speech-to-text software", "Ergonomic seating", "Flexible breaks",
                 "Quiet workspace"]),
        "Muscular Dystrophy": _cap(
            fine="Medium", physical="Low", energy="Low",
            acc=["Power-assist equipment", "Flexible schedule", "Seated workstation",
                 "Fatigue management breaks"]),
        "Chronic Pain": _cap(
            fine="Medium", physical="Low", energy="Low",
            acc=["Ergonomic workstation", "Standing/sitting desk", "Flexible breaks",
                 "Pain-management breaks"]),
        "Other": _cap(fine="Medium", physical="Low", energy="Medium"),
    },
    "Visual": {
        "Total Blindness": _cap(
            fine="Medium", cognitive="High", sensory="Low", visual="Low",
            acc=["Screen reader (NVDA/JAWS)", "Braille display", "Keyboard-only navigation",
                 "High-contrast UI"]),
        "Low Vision": _cap(
            fine="Medium", visual="Low",
            acc=["Screen magnifier", "High-contrast display", "Large-print documents",
                 "Adjustable lighting"]),
        "Color Blindness": _cap(
            fine="Medium", visual="Medium",
            acc=["Color-blind friendly palettes", "Pattern-based charts",
                 "Labeled color coding"]),
        "Other": _cap(fine="Medium", visual="Low", sensory="Low"),
    },
    "Hearing": {
        "Profoundly Deaf": _cap(
            fine="Medium", auditory="Low", social="Medium",
            acc=["Visual alerts", "Live captioning", "Written communication",
                 "Video relay service"]),
        "Hard of Hearing": _cap(
            fine="Medium", auditory="Low",
            acc=["Hearing-aid compatible headsets", "Live captioning",
                 "Quiet meeting rooms"]),
        "Auditory Processing": _cap(
            fine="Medium", auditory="Low", sensory="Low",
            acc=["Written instructions", "Reduced background noise", "Quiet workspace"]),
        "Other": _cap(fine="Medium", auditory="Low"),
    },
    "Learning": {
        "Autism (ASD)": _cap(
            cognitive="Medium", sensory="Low", social="Low", energy="Medium",
            acc=["Quiet workspace", "Written instructions", "Predictable routines",
                 "Noise-cancelling headphones"]),
        "ADHD": _cap(
            cognitive="Medium", sensory="Medium", social="Medium",
            acc=["Task checklists", "Time-management tools", "Quiet workspace",
                 "Short, structured tasks"]),
        "Dyslexia": _cap(
            cognitive="Medium", visual="Medium",
            acc=["Spell-check software", "Text-to-speech", "Simplified layouts",
                 "Extra review time"]),
        "Dysgraphia": _cap(
            fine="Medium", cognitive="Medium",
            acc=["Voice-to-text software", "Typing alternatives", "Extended deadlines"]),
        "Other": _cap(cognitive="Medium", sensory="Medium"),
    },
    "Intellectual": {
        "Down Syndrome": _cap(
            cognitive="Low", sensory="Medium", social="Medium",
            acc=["Step-by-step checklists", "Peer mentoring", "Visual guides",
                 "Structured routines"]),
        "Developmental Delay": _cap(
            cognitive="Low", sensory="Low",
            acc=["Step-by-step training", "Visual instructions", "Patience-first supervision"]),
        "Other": _cap(cognitive="Low"),
    },
    "Psychosocial": {
        "Bipolar Disorder": _cap(
            cognitive="Medium", social="Medium", energy="Medium",
            acc=["Flexible schedule", "Predictable workload", "Supportive supervision",
                 "Wellness breaks"]),
        "Depression": _cap(
            cognitive="Medium", social="Medium", energy="Low",
            acc=["Flexible schedule", "Clear priorities", "Supportive communication"]),
        "Anxiety Disorder": _cap(
            cognitive="Medium", sensory="Low", social="Low",
            acc=["Quiet workspace", "Clear expectations", "Predictable routines"]),
        "PTSD": _cap(
            cognitive="Medium", sensory="Low", social="Low",
            acc=["Quiet workspace", "Predictable schedules", "Supportive environment"]),
        "Schizophrenia": _cap(
            cognitive="Medium", sensory="Low", social="Low",
            acc=["Structured routines", "Low-stimulation environment", "Supportive supervision"]),
        "Other": _cap(cognitive="Medium", social="Medium"),
    },
    "Chronic_Illness": {
        "Cancer Patient/Survivor": _cap(
            energy="Low", physical="Medium",
            acc=["Flexible schedule", "Remote-friendly work", "Medical leave support"]),
        "Rare Disease": _cap(
            energy="Low",
            acc=["Flexible schedule", "Remote-friendly work", "Medical accommodations"]),
        "Speech Impairment": _cap(
            fine="Medium", social="Medium",
            acc=["Written communication", "Text-based tools", "Email-first workflows"]),
        "Chronic Respiratory": _cap(
            physical="Low", energy="Low",
            acc=["Air-purified workspace", "Flexible breaks", "Reduced physical exertion"]),
        "Other": _cap(energy="Low"),
    },
}

EXENTS_DEFAULT = {"Amputee": "Other"}


def _resolve_preset(category, subtype, extent=None):
    """Walk the taxonomy: Category > Subtype > Extent, with sensible fallbacks."""
    cat_map = CAPABILITY_PRESETS.get(category, {})
    if not cat_map:
        return _cap()
    sub_map = cat_map.get(subtype, _cap())
    if isinstance(sub_map, dict) and "fine_motor" not in sub_map:
        extent_key = (extent or EXENTS_DEFAULT.get(subtype) or "Other")
        return sub_map.get(extent_key) or _cap()
    return sub_map


# ---------------------------------------------------------------------------
# Profile parsing
# ---------------------------------------------------------------------------
def parse_legacy_disabilities(disabilities):
    """Parse stored disability strings: 'Physical: Amputee' -> list of dicts."""
    entries = []
    if not disabilities:
        return entries
    if isinstance(disabilities, str):
        try:
            disabilities = json.loads(disabilities)
        except (json.JSONDecodeError, TypeError):
            disabilities = [d.strip() for d in disabilities.split(",") if d.strip()]
    for item in disabilities:
        if isinstance(item, dict):
            entries.append(item)
            continue
        if not isinstance(item, str):
            continue
        m = re.match(r"^([^:]+?):\s*(.+)$", item.strip())
        if m:
            category, rest = m.group(1).strip(), m.group(2).strip()
            extent = None
            em = re.match(r"^(.+?)\s*\((.*)\)$", rest)
            if em:
                subtype, extent = em.group(1).strip(), em.group(2).strip()
            else:
                subtype = rest
            entries.append({"category": category, "subtype": subtype, "extent": extent})
    return entries


def build_capability_profile(disability_profile=None, legacy_disabilities=None):
    """
    Merge structured disability_profile with legacy disability strings into a
    single capability map. User-adjusted capabilities always win.
    """
    caps = _cap()
    seen = []
    acc_list = []

    if isinstance(disability_profile, str):
        try:
            disability_profile = json.loads(disability_profile)
        except (json.JSONDecodeError, TypeError):
            disability_profile = None
    if not isinstance(disability_profile, dict):
        disability_profile = {}

    raw_disabilities = disability_profile.get("disabilities") or []
    for entry in raw_disabilities:
        if isinstance(entry, str):
            parsed = parse_legacy_disabilities([entry])
            entry = parsed[0] if parsed else {"category": entry}
        category = entry.get("category") or "Other"
        subtype = entry.get("subtype") or "Other"
        preset = _resolve_preset(category, subtype, entry.get("extent"))
        seen.append(f"{category}: {subtype}" + (f" ({entry.get('extent')})" if entry.get("extent") else ""))
        for key, value in preset.items():
            if key == "accommodations":
                acc_list.extend(value or [])
                continue
            if isinstance(caps[key], bool):
                caps[key] = caps[key] or bool(value)
            else:
                caps[key] = value if caps[key] == DEFAULT_LEVEL else caps[key]

    for entry in parse_legacy_disabilities(legacy_disabilities):
        category = entry.get("category") or "Other"
        subtype = entry.get("subtype") or "Other"
        preset = _resolve_preset(category, subtype, entry.get("extent"))
        label = f"{category}: {subtype}"
        if label in seen:
            continue
        seen.append(label)
        for key, value in preset.items():
            if key == "accommodations":
                acc_list.extend(value or [])
                continue
            if isinstance(caps[key], bool):
                caps[key] = caps[key] or bool(value)
            else:
                caps[key] = value if caps[key] == DEFAULT_LEVEL else caps[key]

    user_caps = disability_profile.get("capabilities") or {}
    for key, value in user_caps.items():
        if key in caps and value not in (None, ""):
            caps[key] = value

    caps["accommodations"] = list(dict.fromkeys(
        list(disability_profile.get("accommodations") or []) + acc_list
    ))

    return caps


def format_education(education):
    """Format structured education JSON into a readable embedding/report string."""
    if not education:
        return ""
    if isinstance(education, list):
        entries = education
    elif isinstance(education, str):
        try:
            entries = json.loads(education)
        except (json.JSONDecodeError, TypeError):
            return education.strip()
    else:
        entries = []

    parts = []
    for e in entries:
        if not isinstance(e, dict):
            continue
        degree = e.get("degree") or e.get("course") or e.get("area") or ""
        school = e.get("institution") or e.get("school") or ""
        start = e.get("start_date") or ""
        end = e.get("end_date") or e.get("graduation_date") or ""
        status = e.get("status") or ""
        seg = []
        if degree:
            seg.append(degree)
        if school:
            seg.append(school)
        if start or end:
            seg.append(f"({start}-{end})" if start and end else f"({start or end})")
        if status:
            seg.append(status)
        if seg:
            parts.append(" ".join(seg))
    return "; ".join(parts)


def build_qualification_context(user_profile):
    """Disability-blind context for embedding: skills + education + summary + optional."""
    parts = []
    skills = user_profile.get("skills") or ""
    if skills:
        parts.append(f"Skills: {skills}")
    edu = format_education(user_profile.get("education"))
    if edu:
        parts.append(f"Education: {edu}")
    summary = user_profile.get("summary") or ""
    if summary:
        parts.append(f"About me: {summary}")
    experience = user_profile.get("experience") or ""
    if experience:
        parts.append(f"Experience: {experience}")
    return " ".join(parts) if parts else "General Job Search"


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
def _rank(value, mapping):
    return mapping.get(value, mapping.get(DEFAULT_LEVEL, 2))


def _compare_dimension(dim_key, user_level, job_level, mapping, source=None):
    u = _rank(user_level, mapping)
    j = _rank(job_level, mapping)
    gap = j - u
    plain_label = DIMENSION_PLAIN.get(dim_key, dim_key)
    origin = "stated in profile" if source == "stated" else "profile capability baseline"

    ex = {
        "dimension_key": dim_key,
        "dimension": plain_label.title(),
        "job_level": job_level,
        "user_level": user_level,
        "inputs": {
            "job_posting": f"{job_level} {plain_label}",
            "your_profile": f"{user_level} {plain_label}",
            "source": origin,
        },
        "rule": (
            f"If the job demand is at or below your comfort level, it is a comfortable fit. "
            f"A one-step difference is workable with minor adjustments; larger differences require workplace accommodations."
        ),
    }

    if gap >= 2:
        ex.update(
            verdict="mismatch",
            verdict_label="Needs support",
            score=20.0,
            status="fail",
            summary_phrase=f"The {job_level.lower()} requirement for {plain_label} exceeds your current comfort preference ({user_level.lower()}) and would benefit from structured accommodation.",
            decision=f"High friction point: Job requires {job_level.lower()} {plain_label} against your {user_level.lower()} preference.",
            reason=f"The job's demand is substantially higher than your stated comfort. Targeted assistive adjustments or duty restructuring are recommended.",
        )
        return 20.0, "fail", ex

    if gap == 1:
        ex.update(
            verdict="marginal",
            verdict_label="Close match",
            score=60.0,
            status="marginal",
            summary_phrase=f"The {job_level.lower()} demand for {plain_label} is slightly above your comfort baseline ({user_level.lower()}), easily supported with routine adjustments.",
            decision=f"Moderate match: Job requires {job_level.lower()} {plain_label}, slightly exceeding your {user_level.lower()} baseline.",
            reason=f"This represents a manageable stretch that can be comfortably bridged with standard workplace flexibility or minor assistive tools.",
        )
        return 60.0, "marginal", ex

    if j == u:
        ex.update(
            verdict="match",
            verdict_label="Good fit",
            score=100.0,
            status="pass",
            summary_phrase=f"The role's {plain_label} demand ({job_level.lower()}) perfectly aligns with your stated comfort zone.",
            decision=f"Direct alignment: Job requires {job_level.lower()} {plain_label}, directly matching your profile.",
            reason=f"Your comfort level matches the employer's expectations, enabling seamless and fatigue-free daily performance.",
        )
        return 100.0, "pass", ex

    # j < u (job demand is less than user's capacity)
    ex.update(
        verdict="match",
        verdict_label="Good fit",
        score=100.0,
        status="pass",
        summary_phrase=f"The {plain_label} demand is {job_level.lower()}, leaving ample comfort headroom relative to your capabilities ({user_level.lower()}).",
        decision=f"Comfortable headroom: Job only requires {job_level.lower()} {plain_label}, well within your capacity.",
        reason=f"The role places low stress on this capability, giving you comfortable margin and lower risk of fatigue.",
    )
    return 100.0, "pass", ex


def _capability_sources(caps, disability_profile):
    """Which capability levels did the user explicitly state vs. derive from presets."""
    if isinstance(disability_profile, str):
        try:
            disability_profile = json.loads(disability_profile)
        except (json.JSONDecodeError, TypeError):
            disability_profile = {}
    if not isinstance(disability_profile, dict):
        disability_profile = {}
    user_caps = disability_profile.get("capabilities") or {}
    return {
        key: ("stated" if key in user_caps and user_caps.get(key) not in (None, "") else "suggested")
        for key in caps
    }


# ---------------------------------------------------------------------------
# Natural Language Synthesis (Pros, Cons, Workplace Suitability)
# ---------------------------------------------------------------------------

def _synthesize_pros_summary(strengths_ex, overall_score, job, overlap_skills=None, capabilities=None):
    """Generate a punchy, highly explanatory executive summary for Pros / Strengths."""
    job_title = job.get("job_title", "Position")
    work_env = job.get("work_environment", "Indoor")
    remote_note = "remote" if job.get("remote_friendly") else work_env.lower()
    
    top_dims = [ex["dimension"] for ex in strengths_ex[:3]] if strengths_ex else []
    dim_str = ", ".join(top_dims) if top_dims else "general operational demands"
    
    if overlap_skills and len(overlap_skills) > 0:
        top_skills = ", ".join(overlap_skills[:3])
        if overall_score >= 80:
            return f"Excellent ergonomic and vocational fit: your skills in {top_skills} directly match core duties, while the {remote_note} environment supports your {dim_str.lower()} comfort."
        else:
            return f"Solid core alignment: direct overlap in {top_skills} with favorable conditions in {dim_str.lower()}."
    else:
        if overall_score >= 80:
            return f"Strong environmental synergy: the {remote_note} setup at {job.get('employer_name', 'the employer')} provides low-strain conditions across {dim_str.lower()}."
        else:
            return f"Viable baseline match with comfortable headroom in {dim_str.lower()}."


def _synthesize_cons_summary(barriers_ex, marginal_ex, overall_score, job, capabilities=None):
    """Generate a constructive, practical executive summary for Cons / Considerations."""
    acc_list = (capabilities.get("accommodations") if capabilities else []) or []
    acc_text = f" Bridged effectively via: {', '.join(acc_list[:2])}." if acc_list else " Bridged via standard ergonomic setup and flexible pacing."

    if not barriers_ex and not marginal_ex:
        return "Zero critical barriers identified. All physical, cognitive, and sensory requirements sit comfortably within your stated thresholds."

    if barriers_ex:
        b_names = ", ".join([ex["dimension"] for ex in barriers_ex])
        return f"Elevated demand in {b_names} requires proactive adjustments.{acc_text}"

    m_names = ", ".join([ex["dimension"] for ex in marginal_ex])
    return f"Manageable stretch in {m_names}: easily supported through standard workplace flexibility and scheduled rest breaks."


def _synthesize_suitability_summary(overall_score, pass_count, total_count, barriers_ex, marginal_ex, job):
    """Generate a crisp, executive Workplace Suitability verdict."""
    employer = job.get("employer_name", "the employer")
    work_env = job.get("work_environment", "workplace")
    remote_flag = "Remote-friendly" if job.get("remote_friendly") else work_env
    
    if overall_score >= 85:
        return f"🌟 Strong Match ({overall_score:.0f}% Fit): {pass_count} of {total_count} operational dimensions fully aligned. The {remote_flag.lower()} setup at {employer} offers a safe, accessible foundation where your capabilities thrive."
    elif overall_score >= 60:
        stretch_area = marginal_ex[0]['dimension'] if marginal_ex else "routine pacing"
        return f"⚡ Viable Fit ({overall_score:.0f}% Fit): {pass_count} of {total_count} dimensions aligned with minor stretch in {stretch_area.lower()}. Manageable with standard accommodations at {employer}."
    else:
        barrier_name = barriers_ex[0]['dimension'] if barriers_ex else "operational demand"
        return f"⚠️ Consideration Required ({overall_score:.0f}% Fit): High demand in {barrier_name.lower()} exceeds baseline comfort. Recommended only with formal workplace accommodations."


def _build_highlight_bullets(explanations, verdict_types, max_items=3, overlap_skills=None, capabilities=None):
    """Curate concise, scannable bullet points highlighting exact facts."""
    highlights = []
    
    # If building strengths and skills overlap is present, lead with skills!
    if "match" in verdict_types and overlap_skills and len(overlap_skills) > 0:
        highlights.append(f"🎯 Matched Skills: Applies your {', '.join(overlap_skills[:3])} background.")
        
    filtered = [ex for ex in explanations if ex["verdict"] in verdict_types]
    for ex in filtered[:max_items]:
        dim = ex["dimension"]
        lvl = ex["job_level"].lower()
        if ex["verdict"] == "match":
            highlights.append(f"✓ {dim}: {lvl.capitalize()} demand fits your comfort zone.")
        elif ex["verdict"] == "marginal":
            highlights.append(f"⚡ {dim}: Moderate demand ({lvl}) — manageable with minor adjustments.")
        elif ex["verdict"] == "mismatch":
            highlights.append(f"⚠️ {dim}: Elevated demand ({lvl}) — requires employer support.")
            
    if not highlights:
        if "match" in verdict_types:
            highlights.append("✓ Balanced physical and environmental demands.")
        else:
            highlights.append("✓ No major friction points detected across operational dimensions.")
            
    return highlights[:3]


# ---------------------------------------------------------------------------
# Main Compatibility Evaluation Entrypoint
# ---------------------------------------------------------------------------
def score_job_compatibility(user_profile, job, capabilities=None, overlap_skills=None):
    """
    Dimension-by-dimension compatibility scoring producing rich, natural-language
    explainability summaries for pros, cons, and workplace suitability.
    """
    if capabilities is None:
        capabilities = build_capability_profile(
            user_profile.get("disability_profile"), user_profile.get("disabilities")
        )

    explanations = []
    scores = []
    statuses = []
    sources = _capability_sources(capabilities, user_profile.get("disability_profile"))

    dims = [
        ("fine_motor", capabilities.get("fine_motor", "Medium"),
         job.get("fine_motor_demand") or "Medium"),
        ("physical", capabilities.get("physical", "Medium"),
         job.get("physical_demand") or "Medium"),
        ("cognitive", capabilities.get("cognitive", "Medium"),
         job.get("cognitive_load") or "Medium"),
        ("sensory", capabilities.get("sensory", "Medium"),
         job.get("sensory_load") or "Low"),
        ("social", capabilities.get("social", "Moderate"),
         job.get("social_interaction") or "Moderate", SOCIAL_RANK),
        ("visual", capabilities.get("visual", "Medium"),
         job.get("visual_demand") or "Low"),
        ("auditory", capabilities.get("auditory", "Medium"),
         job.get("auditory_demand") or "Low"),
        ("tempo", capabilities.get("energy", "Medium"),
         job.get("work_tempo") or "Moderate", TEMPO_RANK),
        ("intensity", capabilities.get("preferred_intensity", "Medium"),
         job.get("task_intensity") or "Medium"),
    ]

    for dim in dims:
        dim_key = dim[0]
        user_val = dim[1]
        job_val = dim[2]
        mapping = dim[3] if len(dim) > 3 else LEVEL_RANK
        cap_key = {"tempo": "energy", "intensity": "preferred_intensity"}.get(dim_key, dim_key)
        
        score, status, ex = _compare_dimension(
            dim_key, user_val, job_val, mapping, sources.get(cap_key)
        )
        scores.append(score)
        statuses.append(status)
        explanations.append(ex)

    if not scores:
        overall = 60.0
    else:
        hard_fail = any(s <= 20.0 for s in scores)
        overall = float(np.mean(scores))
        if hard_fail:
            overall = min(overall, 40.0)
        overall = round(min(100.0, max(0.0, overall)), 1)

    strengths_ex = [e for e in explanations if e["verdict"] == "match"]
    marginal_ex = [e for e in explanations if e["verdict"] == "marginal"]
    barriers_ex = [e for e in explanations if e["verdict"] == "mismatch"]

    # Synthesized Natural Language Summaries (Word Type & Summaries)
    pros_summary = _synthesize_pros_summary(strengths_ex, overall, job, overlap_skills=overlap_skills, capabilities=capabilities)
    cons_summary = _synthesize_cons_summary(barriers_ex, marginal_ex, overall, job, capabilities=capabilities)
    suitability_summary = _synthesize_suitability_summary(overall, len(strengths_ex), len(explanations), barriers_ex, marginal_ex, job)

    # Curated highlights (concise, human-readable points)
    strengths_highlights = _build_highlight_bullets(explanations, ["match"], max_items=3, overlap_skills=overlap_skills, capabilities=capabilities)
    barriers_highlights = _build_highlight_bullets(explanations, ["mismatch", "marginal"], max_items=3, capabilities=capabilities)
    if not barriers_highlights:
        barriers_highlights = ["Zero critical barriers: all dimensions fall comfortably within your stated comfort."]

    # Backwards-compatible legacy list mappings populated with clean summary phrases
    reasons_list = [ex["summary_phrase"] for ex in explanations]

    facts_dict = {
        "analysis": suitability_summary,
        "performance": pros_summary,
        "advice": f"Recommended accommodations: {', '.join(capabilities.get('accommodations', [])[:3]) if capabilities.get('accommodations') else 'Standard ergonomic review and adjustable workstation.'}",
        "hinder": cons_summary,
        "barriers": barriers_highlights,
    }

    return {
        "score": overall,
        "pros_summary": pros_summary,
        "cons_summary": cons_summary,
        "suitability_summary": suitability_summary,
        "strengths": strengths_highlights,
        "plain_strengths": strengths_highlights,
        "barriers": barriers_highlights,
        "plain_barriers": barriers_highlights,
        "reasons": reasons_list,
        "plain_reasons": reasons_list,
        "ontology_reasons": reasons_list,
        "explanations": explanations,
        "narrative": suitability_summary,
        "accommodations": capabilities.get("accommodations") or [],
        "facts": facts_dict,
    }
