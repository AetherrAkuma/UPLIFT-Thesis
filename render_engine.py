"""
ATS-friendly resume generation via RenderCV.
Generates professional PDF resumes from user profile data.

Uses RenderCV's Python API directly: builds the data model from user
profile fields, generates Typst source, then compiles to PDF.
"""
import json
import re
import base64
import tempfile
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("render_engine")

AVAILABLE_THEMES = [
    "classic", "ember", "engineeringclassic", "engineeringresumes",
    "harvard", "ink", "moderncv", "opal", "sb2nov"
]


def generate_resume(
    user_profile: dict,
    theme: str = "classic"
) -> Optional[str]:
    """
    Build a RenderCV model from user profile fields and render to PDF.

    Args:
        user_profile: dict with keys: name, email, summary, education,
                      experience, skills, projects, certifications, awards
        theme: one of AVAILABLE_THEMES

    Returns:
        base64-encoded PDF string, or None on failure
    """
    try:
        from rendercv.schema.models.rendercv_model import RenderCVModel
        from rendercv.schema.rendercv_model_builder import build_rendercv_dictionary_and_model
        from rendercv.renderer.typst import generate_typst
        from rendercv.renderer.pdf_png import generate_pdf
    except ImportError:
        logger.error("rendercv not installed. Run: pip install 'rendercv[full]'")
        return None

    yaml_content = _build_yaml(user_profile, theme)

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = Path(tmpdir) / "Resume_CV.yaml"
        input_path.write_text(yaml_content, encoding="utf-8")

        try:
            try:
                _, model = build_rendercv_dictionary_and_model(
                    yaml_content, input_file_path=input_path
                )
            except Exception as build_err:
                logger.warning(f"Initial RenderCV validation failed ({build_err}), retrying without optional phone field...")
                safe_profile = dict(user_profile)
                safe_profile.pop("phone", None)
                safe_profile.pop("contact_number", None)
                yaml_content = _build_yaml(safe_profile, theme)
                input_path.write_text(yaml_content, encoding="utf-8")
                _, model = build_rendercv_dictionary_and_model(
                    yaml_content, input_file_path=input_path
                )

            typst_path = generate_typst(model)
            if typst_path is None:
                logger.error("generate_typst returned None")
                return None

            pdf_path = generate_pdf(model, typst_path)
            if pdf_path is None or not pdf_path.exists():
                logger.error("generate_pdf returned no file")
                return None

            pdf_bytes = pdf_path.read_bytes()
            return base64.b64encode(pdf_bytes).decode()

        except Exception as e:
            logger.error(f"Resume generation failed: {type(e).__name__}: {e}")
            return None


def _is_valid_rendercv_phone(p: Optional[str]) -> bool:
    if not p:
        return False
    try:
        from pydantic_extra_types.phone_numbers import PhoneNumber
        PhoneNumber._validate(p, None)
        return True
    except Exception:
        return False


def _format_phone(raw_phone: str) -> Optional[str]:
    if not raw_phone:
        return None
    p = str(raw_phone).strip()
    if not p:
        return None
    try:
        import phonenumbers
        parsed = phonenumbers.parse(p, "PH")
        if phonenumbers.is_possible_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
    except Exception:
        pass
    d = re.sub(r'\D', '', p)
    if p.startswith('09') and len(d) == 11:
        return f"+63 {d[1:4]} {d[4:7]} {d[7:]}"
    if p.startswith('+'):
        return p
    return None


def _extract_username(val: str, network: str) -> str:
    """Extract clean username/handle from a URL or raw username."""
    if not val:
        return ""
    v = str(val).strip().rstrip("/")
    if network.lower() == "linkedin":
        m = re.search(r"linkedin\.com/(?:in|company)/([^/?#]+)", v, re.IGNORECASE)
        if m:
            return m.group(1)
    elif network.lower() == "github":
        m = re.search(r"github\.com/([^/?#]+)", v, re.IGNORECASE)
        if m:
            return m.group(1)
    v = v.lstrip("@")
    if "/" in v:
        v = v.split("/")[-1]
    return v


def _clean_highlights(raw) -> Optional[list]:
    """Ensure highlights are a clean list of strings for RenderCV."""
    if not raw:
        return None
    if isinstance(raw, list):
        cleaned = [str(x).strip().lstrip("- •*").strip() for x in raw if str(x).strip()]
        return cleaned if cleaned else None
    if isinstance(raw, str):
        lines = [line.strip().lstrip("- •*").strip() for line in raw.split("\n")]
        cleaned = [line for line in lines if line]
        return cleaned if cleaned else None
    return None


def _build_yaml(user_profile: dict, theme: str) -> str:
    """Build a RenderCV-compatible YAML string from user profile data."""
    name = (user_profile.get("name") or "Candidate").strip()
    email = (user_profile.get("email") or "").strip()
    raw_phone = (user_profile.get("phone") or user_profile.get("contact_number") or "").strip()
    formatted_phone = _format_phone(raw_phone)
    location = (user_profile.get("location") or user_profile.get("address") or "").strip()

    sections = {}

    # Summary
    summary = (user_profile.get("summary") or "").strip()
    if summary:
        sections["Summary"] = summary

    # Education
    education_raw = user_profile.get("education", "")
    education_entries = _parse_education(education_raw)
    if education_entries:
        sections["Education"] = education_entries

    # Experience
    experience_raw = user_profile.get("experience", "")
    experience_entries = _parse_experience(experience_raw)
    if experience_entries:
        sections["Experience"] = experience_entries

    # Skills
    skills_raw = user_profile.get("skills", "")
    if skills_raw:
        skill_items = _parse_skills(skills_raw)
        if skill_items:
            sections["Skills"] = skill_items

    # Projects
    projects_raw = user_profile.get("projects", "")
    project_entries = _parse_normal_entries(projects_raw, "Project")
    if project_entries:
        sections["Projects"] = project_entries

    # Certifications
    certs_raw = user_profile.get("certifications", "")
    cert_entries = _parse_bullet_entries(certs_raw)
    if cert_entries:
        sections["Certifications"] = cert_entries

    # Awards
    awards_raw = user_profile.get("awards", "")
    award_entries = _parse_bullet_entries(awards_raw)
    if award_entries:
        sections["Awards & Honors"] = award_entries

    # Build YAML manually
    lines = []
    lines.append("cv:")
    lines.append(f"  name: \"{_yaml_escape(name)}\"")
    if location:
        lines.append(f"  location: \"{_yaml_escape(location)}\"")
    if email:
        lines.append(f"  email: \"{_yaml_escape(email)}\"")

    if formatted_phone and _is_valid_rendercv_phone(formatted_phone):
        lines.append(f"  phone: \"{_yaml_escape(formatted_phone)}\"")
    elif raw_phone:
        lines.append("  custom_connections:")
        lines.append("    - fontawesome_icon: \"phone\"")
        lines.append(f"      placeholder: \"{_yaml_escape(raw_phone)}\"")
        lines.append("      url: null")

    website = (user_profile.get("website") or user_profile.get("portfolio") or "").strip()
    if website:
        if not (website.startswith("http://") or website.startswith("https://")):
            website = f"https://{website}"
        lines.append(f"  website: \"{_yaml_escape(website)}\"")

    socials = []
    linkedin = (user_profile.get("linkedin") or "").strip()
    github = (user_profile.get("github") or "").strip()
    if linkedin:
        u = _extract_username(linkedin, "LinkedIn")
        if u:
            socials.append(("LinkedIn", u))
    if github:
        u = _extract_username(github, "GitHub")
        if u:
            socials.append(("GitHub", u))

    if socials:
        lines.append("  social_networks:")
        for net, uname in socials:
            lines.append(f"    - network: \"{net}\"")
            lines.append(f"      username: \"{_yaml_escape(uname)}\"")

    lines.append("  sections:")

    if sections:
        for section_name, entries in sections.items():
            if isinstance(entries, str):
                # Simple text section (like Summary)
                lines.append(f"    {_yaml_escape(section_name)}:")
                lines.append(f"      - {_yaml_escape(entries)}")
            elif isinstance(entries, list):
                if not entries:
                    continue
                lines.append(f"    {_yaml_escape(section_name)}:")
                for entry in entries:
                    if isinstance(entry, dict):
                        # Complex entry
                        first = True
                        for key, val in entry.items():
                            if val is None or val == "" or val == []:
                                continue  # Skip empty optional fields
                            prefix = "      - " if first else "        "
                            if isinstance(val, list):
                                if len(val) == 0:
                                    continue
                                lines.append(f"{prefix}{key}:")
                                for item in val:
                                    lines.append(f"          - \"{_yaml_escape(str(item))}\"")
                            else:
                                lines.append(f"{prefix}{key}: \"{_yaml_escape(str(val))}\"")
                            first = False
                    elif isinstance(entry, str):
                        lines.append(f"      - label: \"{_yaml_escape(entry)}\"")
                        lines.append(f"        details: \" \"")

    lines.append("")
    lines.append("design:")
    lines.append(f"  theme: {theme}")
    lines.append("  entries:")
    lines.append("    degree_width: 1.5cm")
    lines.append("")
    lines.append("locale:")
    lines.append("  language: english")
    lines.append("")

    return "\n".join(lines)


def _yaml_escape(s: str) -> str:
    """Escape a string for safe inclusion in YAML."""
    if not isinstance(s, str):
        s = str(s)
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _parse_education(raw) -> list:
    """Parse education field. Tries JSON list, falls back to newline-separated entries."""
    if not raw:
        return []

    # If already a list or dict
    if isinstance(raw, list):
        return [_education_entry(e) for e in raw if e]

    if isinstance(raw, str):
        if not raw.strip():
            return []
        try:
            data = json.loads(raw)
            if isinstance(data, list):
                return [_education_entry(e) for e in data if e]
            elif isinstance(data, dict):
                return [_education_entry(data)]
        except (json.JSONDecodeError, TypeError):
            pass

        entries = []
        for line in raw.strip().split("\n"):
            line = line.strip().lstrip("- •*").strip()
            if line:
                entries.append(_education_entry({"raw": line}))
        return entries

    return []


def _clean_education_degree_and_area(degree: str, area: str):
    """Clean and split degree and major/area so RenderCV formats cleanly in the classic 2-column layout."""
    degree = (degree or "").strip()
    area = (area or "").strip()

    DEGREE_PREFIXES = [
        ("bachelor of science in ", "BS"),
        ("bachelor of arts in ", "BA"),
        ("bachelor of science ", "BS"),
        ("bachelor of arts ", "BA"),
        ("bs in ", "BS"),
        ("ba in ", "BA"),
        ("bs ", "BS"),
        ("ba ", "BA"),
        ("bachelor in ", "BS"),
        ("bachelor's in ", "BS"),
        ("bachelor of ", "BS"),
        ("master of science in ", "MS"),
        ("master of arts in ", "MA"),
        ("ms in ", "MS"),
        ("ms ", "MS"),
        ("master in ", "MS"),
        ("master's in ", "MS"),
        ("doctor of philosophy in ", "PhD"),
        ("phd in ", "PhD"),
        ("associate in ", "AS"),
        ("associate of ", "AS"),
        ("diploma in ", "Dip"),
        ("certificate in ", "Cert"),
        ("senior high school - ", "SHS"),
        ("senior high school ", "SHS"),
        ("high school ", "HS")
    ]

    DEGREE_SHORT_MAP = {
        "bachelor of science": "BS",
        "bachelor of arts": "BA",
        "master of science": "MS",
        "master of arts": "MA",
        "doctor of philosophy": "PhD",
        "phd": "PhD",
        "bachelor's degree": "BS",
        "master's degree": "MS",
        "senior high school": "SHS",
        "high school": "HS",
        "college": "BS",
        "masteral/doctoral": "PhD"
    }

    if not degree and not area:
        return "", "General Studies"
    if not degree and area:
        for prefix, deg_name in DEGREE_PREFIXES:
            if area.lower().startswith(prefix):
                return deg_name, area[len(prefix):].strip()
        return "", area
    if degree and not area:
        for prefix, deg_name in DEGREE_PREFIXES:
            if degree.lower().startswith(prefix):
                return deg_name, degree[len(prefix):].strip()
        d_lower = degree.lower()
        if d_lower in DEGREE_SHORT_MAP:
            return DEGREE_SHORT_MAP[d_lower], ""
        return degree, ""

    # If both degree and area are supplied
    d_lower = degree.lower()
    if d_lower in DEGREE_SHORT_MAP:
        degree = DEGREE_SHORT_MAP[d_lower]

    if degree.lower() == area.lower() or area.lower() in degree.lower():
        for prefix, deg_name in DEGREE_PREFIXES:
            if degree.lower().startswith(prefix):
                clean_area = degree[len(prefix):].strip() or area
                return deg_name, clean_area
        return degree, area

    for prefix, deg_name in DEGREE_PREFIXES:
        if degree.lower().startswith(prefix):
            return deg_name, area

    return degree, area


def _education_entry(data: dict) -> dict:
    """Map a user education dict to RenderCV EducationEntry (guaranteeing required schema fields)."""
    raw = (data.get("raw") or "").strip()
    institution = (data.get("institution") or data.get("school") or "").strip()
    area = (data.get("area") or data.get("field") or data.get("major") or data.get("program") or "").strip()
    degree = (data.get("degree") or data.get("level") or "").strip()

    if raw and (not institution or not area):
        if " at " in raw:
            parts = raw.split(" at ", 1)
            if not area: area = parts[0].strip()
            if not institution: institution = parts[1].strip()
        elif " - " in raw:
            parts = raw.split(" - ", 1)
            if not area: area = parts[0].strip()
            if not institution: institution = parts[1].strip()
        elif ", " in raw:
            parts = raw.split(", ", 1)
            if not area: area = parts[0].strip()
            if not institution: institution = parts[1].strip()
        else:
            if not area: area = raw[:50]
            if not institution: institution = "Educational Institution"

    if not institution:
        institution = "Educational Institution"

    # Normalize degree and area cleanly
    clean_deg, clean_area = _clean_education_degree_and_area(degree, area)

    return {
        "institution": institution,
        "area": clean_area or "General Studies",
        "degree": clean_deg or None,
        "date": data.get("date") or "",
        "start_date": data.get("start_date") or "",
        "end_date": data.get("end_date") or data.get("graduation_date") or "",
        "location": data.get("location") or "",
        "summary": data.get("summary") or None,
        "highlights": _clean_highlights(data.get("highlights")),
    }


def _parse_experience(raw) -> list:
    """Parse experience field. Tries JSON list, falls back to newline-separated."""
    if not raw:
        return []

    if isinstance(raw, list):
        return [_experience_entry(e) for e in raw if e]

    if isinstance(raw, str):
        if not raw.strip():
            return []
        try:
            data = json.loads(raw)
            if isinstance(data, list):
                return [_experience_entry(e) for e in data if e]
            elif isinstance(data, dict):
                return [_experience_entry(data)]
        except (json.JSONDecodeError, TypeError):
            pass

        entries = []
        for line in raw.strip().split("\n"):
            line = line.strip().lstrip("- •*").strip()
            if line:
                entries.append(_experience_entry({"raw": line}))
        return entries

    return []


def _experience_entry(data: dict) -> dict:
    """Map a user experience dict to RenderCV ExperienceEntry (guaranteeing required schema fields)."""
    raw = (data.get("raw") or "").strip()
    company = (data.get("company") or data.get("organization") or "").strip()
    position = (data.get("position") or data.get("title") or data.get("role") or "").strip()

    if raw and (not company or not position):
        if " at " in raw:
            parts = raw.split(" at ", 1)
            if not position: position = parts[0].strip()
            if not company: company = parts[1].strip()
        elif " - " in raw:
            parts = raw.split(" - ", 1)
            if not position: position = parts[0].strip()
            if not company: company = parts[1].strip()
        elif ", " in raw:
            parts = raw.split(", ", 1)
            if not position: position = parts[0].strip()
            if not company: company = parts[1].strip()
        else:
            if not position: position = raw[:40]
            if not company: company = "Professional Experience"

    if not position:
        position = "Professional Role" if company else "General Experience"
    if not company:
        company = "Organization"

    return {
        "company": company,
        "position": position,
        "date": data.get("date") or data.get("year") or "",
        "start_date": data.get("start_date") or "",
        "end_date": data.get("end_date") or "",
        "location": data.get("location") or "",
        "summary": data.get("summary") or None,
        "highlights": _clean_highlights(data.get("highlights") or data.get("responsibilities") or data.get("description")),
    }


def _parse_skills(raw) -> list:
    """
    Parse skills field into RenderCV OneLineEntry format.
    Prevents empty colons like 'Python:' by grouping flat skills into clean entries
    or preserving category labels when present.
    """
    if not raw:
        return []

def _clean_skill_text(text: str) -> str:
    if not text:
        return ""
    clean = str(text).strip().lstrip("- •*").strip()
    clean = re.sub(r'^(?:core\s+skills?|technical\s+skills?)\s*[:\-–—]\s*', '', clean, flags=re.IGNORECASE).strip()
    return clean


def _parse_skills(raw) -> list:
    """Parse skills into RenderCV bullet entries so each skill is on its own line."""
    if not raw:
        return []

    # 1. If already a list
    if isinstance(raw, list):
        entries = []
        for item in raw:
            if isinstance(item, dict):
                b = item.get("bullet") or item.get("name") or item.get("details") or item.get("label")
                c = _clean_skill_text(b)
                if c:
                    entries.append({"bullet": c})
            elif isinstance(item, str) and item.strip():
                for line in item.split("\n"):
                    c = _clean_skill_text(line)
                    if c:
                        entries.append({"bullet": c})
        return entries

    # 2. If it's a dict
    if isinstance(raw, dict):
        result = []
        for category, items in raw.items():
            if isinstance(items, list):
                val = ", ".join(str(x).strip() for x in items if str(x).strip())
            else:
                val = str(items).strip()
            if val:
                c_val = _clean_skill_text(val)
                cat_clean = _clean_skill_text(category)
                if cat_clean and c_val:
                    result.append({"bullet": f"{cat_clean}: {c_val}"})
                elif c_val:
                    result.append({"bullet": c_val})
        return result

    # 3. If it's a string
    if isinstance(raw, str):
        raw_str = raw.strip()
        if not raw_str:
            return []

        try:
            data = json.loads(raw_str)
            if isinstance(data, (list, dict)):
                return _parse_skills(data)
        except (json.JSONDecodeError, TypeError):
            pass

        # Split into individual skill items
        if "\n" in raw_str:
            parts = [_clean_skill_text(l) for l in raw_str.split("\n") if l.strip()]
        else:
            parts = [_clean_skill_text(p) for p in raw_str.split(",") if p.strip()]

        return [{"bullet": p} for p in parts if p]

    return []


def _split_line_items(text: str) -> list:
    if not text:
        return []
    lines = []
    if "\n" in text:
        raw_lines = text.split("\n")
    elif ". " in text:
        raw_lines = text.split(". ")
    elif "; " in text:
        raw_lines = text.split("; ")
    else:
        raw_lines = [text]
    for l in raw_lines:
        clean = l.strip().lstrip("- •*").rstrip(".").strip()
        if clean:
            lines.append(clean)
    return lines


def _parse_bullet_entries(raw) -> list:
    """Parse list of strings or JSON into BulletEntry dicts (bullet: text) for clean single-line bullet entries."""
    if not raw:
        return []
    items = []
    if isinstance(raw, list):
        for x in raw:
            if isinstance(x, str) and x.strip():
                for part in _split_line_items(x):
                    items.append({"bullet": part})
            elif isinstance(x, dict):
                b = (x.get("bullet") or x.get("name") or x.get("title") or "").strip()
                if b:
                    for part in _split_line_items(b):
                        items.append({"bullet": part})
        return items

    if isinstance(raw, str):
        if not raw.strip():
            return []
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return _parse_bullet_entries(parsed)
            elif isinstance(parsed, dict):
                return _parse_bullet_entries(list(parsed.values()))
        except (json.JSONDecodeError, TypeError):
            pass
        for part in _split_line_items(raw):
            items.append({"bullet": part})
        return items

    return []


def _parse_normal_entries(raw, default_name: str) -> list:
    """Parse projects/certifications/awards into NormalEntry format (guaranteeing name)."""
    if not raw:
        return []

    if isinstance(raw, list):
        entries = []
        for e in raw:
            if isinstance(e, dict):
                name = (e.get("name") or e.get("title") or default_name).strip()
                entries.append({
                    "name": name if name else default_name,
                    "summary": e.get("summary") or e.get("description") or "",
                    "date": e.get("date") or "",
                    "highlights": _clean_highlights(e.get("highlights")) or [],
                })
            elif isinstance(e, str) and e.strip():
                entries.append({"name": e.strip(), "summary": "", "date": "", "highlights": []})
        return entries

    if isinstance(raw, str):
        if not raw.strip():
            return []
        try:
            data = json.loads(raw)
            if isinstance(data, list):
                entries = []
                for e in data:
                    if isinstance(e, dict):
                        name = (e.get("name") or e.get("title") or default_name).strip()
                        entries.append({
                            "name": name if name else default_name,
                            "summary": e.get("summary") or e.get("description") or "",
                            "date": e.get("date") or "",
                            "highlights": _clean_highlights(e.get("highlights")) or [],
                        })
                    elif isinstance(e, str) and e.strip():
                        entries.append({"name": e.strip(), "summary": "", "date": "", "highlights": []})
                return entries
        except (json.JSONDecodeError, TypeError):
            pass

        entries = []
        for line in raw.strip().split("\n"):
            line = line.strip().lstrip("- •*").strip()
            if line:
                entries.append({"name": line, "summary": "", "date": "", "highlights": []})
        return entries

    return []


# --- CLI test harness ---
if __name__ == "__main__":
    test_profile = {
        "name": "Maria Santos",
        "email": "maria@example.com",
        "summary": "Software engineer specializing in accessible technology and inclusive design.",
        "education": "BS Computer Science at UP Diliman",
        "experience": "Data Analyst at ABC Corp (2 years)",
        "skills": "JavaScript, React, Python, PostgreSQL, Accessibility (WCAG), Git",
        "projects": "UPLIFT AI Platform",
        "certifications": "AWS Certified Cloud Practitioner",
        "awards": "Top Performer Award 2024"
    }
    result = generate_resume(test_profile, theme="engineeringclassic")
    if result:
        print(f"SUCCESS: Generated base64 PDF ({len(result)} chars)")
    else:
        print("FAILED: No PDF generated")
