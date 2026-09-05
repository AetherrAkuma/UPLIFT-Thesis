import tempfile
from pathlib import Path
from rendercv.schema.rendercv_model_builder import build_rendercv_dictionary_and_model
from rendercv.renderer.typst import generate_typst
from rendercv.renderer.pdf_png import generate_pdf

def test_skills_yaml(title, skills_entries):
    print(f"\n--- Testing: {title} ---")
    yaml_lines = [
        "cv:",
        "  name: Reymar Candidate",
        "  sections:",
        "    Skills:"
    ]
    for entry in skills_entries:
        yaml_lines.append(f"      - label: \"{entry['label']}\"")
        yaml_lines.append(f"        details: \"{entry['details']}\"")
    yaml_lines.extend([
        "design:",
        "  theme: classic",
        "locale:",
        "  language: english"
    ])
    yaml_text = "\n".join(yaml_lines)
    with tempfile.TemporaryDirectory() as tmpdir:
        p = Path(tmpdir) / "test.yaml"
        p.write_text(yaml_text, encoding="utf-8")
        try:
            _, model = build_rendercv_dictionary_and_model(yaml_text, input_file_path=p)
            typ = generate_typst(model)
            pdf = generate_pdf(model, typ)
            print("  PDF Size:", pdf.stat().st_size)
            lines = typ.read_text(encoding="utf-8").splitlines()
            for l in lines:
                if "Skills" in l or "Python" in l:
                    print("   ", l)
        except Exception as e:
            print("  Error:", e)

# Test 1: label = "" (plain comma-separated list of skills under Skills)
test_skills_yaml("Empty label (plain inline skills)", [
    {"label": "", "details": "Python, SQL, Tableau, Data Cleaning, Statistics"}
])

# Test 2: label = "Core Skills"
test_skills_yaml("Core Skills label", [
    {"label": "Core Skills", "details": "Python, SQL, Tableau, Data Cleaning, Statistics"}
])

# Test 3: Multiple categorized lines
test_skills_yaml("Categorized lines", [
    {"label": "Languages & Tools", "details": "Python, SQL, Tableau"},
    {"label": "Data & Analysis", "details": "Data Cleaning, Statistics"}
])
