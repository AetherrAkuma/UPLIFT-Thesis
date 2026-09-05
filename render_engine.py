"""
ATS-friendly resume generation via RenderCV.
Generates professional PDF resumes from user profile data.

Uses RenderCV's Python API directly: builds the data model from user
profile fields, generates Typst source, then compiles to PDF.
"""
import json
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


def _build_yaml(user_profile: dict, theme: str) -> str:
    """Build a RenderCV-compatible YAML string from user profile data."""
    name = (user_profile.get("name") or "Candidate").strip()
    email = (user_profile.get("email") or "").strip()
    phone = (user_profile.get("phone") or "").strip()
    location = (user_profile.get("location") or "").strip()

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
    cert_entries = _parse_normal_entries(certs_raw, "Certification")
    if cert_entries:
        sections["Certifications"] = cert_entries

    # Awards
    awards_raw = user_profile.get("awards", "")
    award_entries = _parse_normal_entries(awards_raw, "Award")
    if award_entries:
        sections["Awards"] = award_entries

    # Build YAML manually
    lines = []
    lines.append("cv:")
    lines.append(f"  name: \"{_yaml_escape(name)}\"")
    if email:
        lines.append(f"  email: \"{_yaml_escape(email)}\"")
    if phone:
        lines.append(f"  phone: \"{_yaml_escape(phone)}\"")
    if location:
        lines.append(f"  location: \"{_yaml_escape(location)}\"")
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
    lines.append("")
    lines.append(f"design:")
    lines.append(f"  theme: {theme}")
    lines.append(f"  entries:")
    lines.append(f"    degree_width: 3.5cm")
    lines.append(f"  templates:")
    lines.append(f"    education_entry:")
    lines.append(f"      degree_column: \"\"")
    lines.append(f"      main_column: \"**INSTITUTION**, DEGREE in AREA\\nSUMMARY\\nHIGHLIGHTS\"")
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
    """Clean and split degree and major/area so RenderCV formats cleanly without narrow column wrapping."""
    degree = (degree or "").strip()
    area = (area or "").strip()

    DEGREE_PREFIXES = [
        ("bachelor of science in ", "Bachelor of Science"),
        ("bachelor of arts in ", "Bachelor of Arts"),
        ("bachelor of science ", "Bachelor of Science"),
        ("bachelor of arts ", "Bachelor of Arts"),
        ("bs in ", "Bachelor of Science"),
        ("ba in ", "Bachelor of Arts"),
        ("bs ", "Bachelor of Science"),
        ("ba ", "Bachelor of Arts"),
        ("bachelor in ", "Bachelor's Degree"),
        ("bachelor's in ", "Bachelor's Degree"),
        ("bachelor of ", "Bachelor's Degree"),
        ("master of science in ", "Master of Science"),
        ("master of arts in ", "Master of Arts"),
        ("ms in ", "Master of Science"),
        ("ms ", "Master of Science"),
        ("master in ", "Master's Degree"),
        ("master's in ", "Master's Degree"),
        ("doctor of philosophy in ", "PhD"),
        ("phd in ", "PhD"),
        ("associate in ", "Associate Degree"),
        ("associate of ", "Associate Degree"),
        ("diploma in ", "Diploma"),
        ("certificate in ", "Certificate"),
        ("senior high school - ", "Senior High School"),
        ("senior high school ", "Senior High School"),
        ("high school ", "High School")
    ]

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
        return "", degree

    # If both degree and area are supplied
    if degree.lower() == area.lower() or area.lower() in degree.lower():
        for prefix, deg_name in DEGREE_PREFIXES:
            if degree.lower().startswith(prefix):
                clean_area = degree[len(prefix):].strip() or area
                return deg_name, clean_area
        return "", area

    # If degree has a prefix like "BS Information Technology" but area is "Information Technology"
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
        "highlights": data.get("highlights") or None,
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
        "date": data.get("date") or "",
        "start_date": data.get("start_date") or "",
        "end_date": data.get("end_date") or "",
        "location": data.get("location") or "",
        "summary": data.get("summary") or None,
        "highlights": data.get("highlights") or None,
    }


def _parse_skills(raw) -> list:
    """
    Parse skills field into RenderCV OneLineEntry format.
    Prevents empty colons like 'Python:' by grouping flat skills into clean entries
    or preserving category labels when present.
    """
    if not raw:
        return []

    # 1. If already a list
    if isinstance(raw, list):
        if raw and isinstance(raw[0], dict):
            entries = []
            for e in raw:
                lbl = str(e.get("label", "")).strip()
                det = str(e.get("details", "")).strip()
                if lbl or det:
                    entries.append({"label": lbl, "details": det or " "})
            return entries

        # List of strings
        items = [str(s).strip() for s in raw if s and str(s).strip()]
        if items:
            categorized = []
            flat_items = []
            for item in items:
                if ":" in item:
                    cat, val = item.split(":", 1)
                    if cat.strip() and val.strip():
                        categorized.append({"label": cat.strip(), "details": val.strip()})
                    else:
                        flat_items.append(item)
                else:
                    flat_items.append(item)
            if flat_items:
                categorized.append({"label": "Core Skills", "details": ", ".join(flat_items)})
            return categorized
        return []

    # 2. If it's a dict
    if isinstance(raw, dict):
        result = []
        for category, items in raw.items():
            if isinstance(items, list):
                val = ", ".join(str(x).strip() for x in items if str(x).strip())
            else:
                val = str(items).strip()
            if val:
                result.append({"label": str(category).strip(), "details": val})
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

        # Split lines first to check for category prefixes like "Programming: Python, SQL"
        lines = [l.strip().lstrip("- •*").strip() for l in raw_str.split("\n") if l.strip()]
        categorized = []
        flat_items = []

        for line in lines:
            if ":" in line:
                cat, val = line.split(":", 1)
                if cat.strip() and val.strip():
                    categorized.append({"label": cat.strip(), "details": val.strip()})
                else:
                    parts = [p.strip() for p in line.split(",") if p.strip()]
                    flat_items.extend(parts)
            else:
                parts = [p.strip() for p in line.split(",") if p.strip()]
                flat_items.extend(parts)

        if flat_items:
            categorized.append({"label": "Core Skills", "details": ", ".join(flat_items)})

        return categorized

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
                    "highlights": e.get("highlights") or [],
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
                            "highlights": e.get("highlights") or [],
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
