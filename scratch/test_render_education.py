import tempfile
from pathlib import Path
from rendercv.schema.rendercv_model_builder import build_rendercv_dictionary_and_model
from rendercv.renderer.typst import generate_typst
from rendercv.renderer.pdf_png import generate_pdf

def test_config(name, yaml_text):
    print(f"\n--- Testing: {name} ---")
    with tempfile.TemporaryDirectory() as tmpdir:
        p = Path(tmpdir) / "test.yaml"
        p.write_text(yaml_text, encoding="utf-8")
        try:
            _, model = build_rendercv_dictionary_and_model(yaml_text, input_file_path=p)
            typ = generate_typst(model)
            pdf = generate_pdf(model, typ)
            print("  PDF Generated Successfully! Size:", pdf.stat().st_size)
            lines = typ.read_text(encoding="utf-8").splitlines()
            for i, l in enumerate(lines):
                if "#education-entry(" in l:
                    for j in range(i, min(len(lines), i+15)):
                        print("   ", lines[j])
                    break
        except Exception as e:
            print("  Failed:", e)

# Test 1: Increasing degree_width in design.entries
yaml_width = """cv:
  name: Reymar Candidate
  sections:
    Education:
      - institution: University of the Philippines
        area: Information Technology
        degree: Bachelor of Science
        date: 2018 - 2022
design:
  theme: classic
  entries:
    degree_width: 4.5cm
"""

# Test 2: Formatting degree inside main_column by disabling degree_column
yaml_no_col = """cv:
  name: Reymar Candidate
  sections:
    Education:
      - institution: University of the Philippines
        area: Information Technology
        degree: Bachelor of Science
        date: 2018 - 2022
design:
  theme: classic
  templates:
    education_entry:
      degree_column: ""
      main_column: "**INSTITUTION**, DEGREE in AREA"
"""

# Test 3: Formatting degree and area cleanly on row 2:
# e.g. "University of the Philippines" on row 1, "Bachelor of Science in Information Technology" on row 2
yaml_clean_lines = """cv:
  name: Reymar Candidate
  sections:
    Education:
      - institution: University of the Philippines
        area: Information Technology
        degree: Bachelor of Science
        date: 2018 - 2022
design:
  theme: classic
  templates:
    education_entry:
      degree_column: ""
      main_column: "**INSTITUTION**\\nDEGREE in AREA"
"""

test_config("Increased degree_width (4.5cm)", yaml_width)
test_config("Inline (INSTITUTION, DEGREE in AREA)", yaml_no_col)
test_config("Two-line (INSTITUTION \\n DEGREE in AREA)", yaml_clean_lines)
