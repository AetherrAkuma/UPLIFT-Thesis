import tempfile
from pathlib import Path
from rendercv.schema.rendercv_model_builder import build_rendercv_dictionary_and_model
from rendercv.renderer.typst import generate_typst
from rendercv.renderer.pdf_png import generate_pdf

AVAILABLE_THEMES = [
    "classic", "ember", "engineeringclassic", "engineeringresumes",
    "harvard", "ink", "moderncv", "opal", "sb2nov"
]

profile = {
    "name": "Reymar Candidate",
    "education": [
        {
            "institution": "University of the Philippines",
            "area": "IT",
            "degree": "Bachelor of Science",
            "start_date": "2018-01",
            "end_date": "2022-01"
        }
    ]
}

def build_test_yaml(theme):
    return f"""cv:
  name: Reymar Candidate
  sections:
    Education:
      - institution: University of the Philippines
        area: IT
        degree: Bachelor of Science
        start_date: 2018-01
        end_date: 2022-01
design:
  theme: {theme}
  entries:
    degree_width: 3.5cm
  templates:
    education_entry:
      degree_column: ""
      main_column: "**INSTITUTION**, DEGREE in AREA\\nSUMMARY\\nHIGHLIGHTS"
locale:
  language: english
"""

for theme in AVAILABLE_THEMES:
    y = build_test_yaml(theme)
    with tempfile.TemporaryDirectory() as tmpdir:
        p = Path(tmpdir) / "test.yaml"
        p.write_text(y, encoding="utf-8")
        try:
            _, model = build_rendercv_dictionary_and_model(y, input_file_path=p)
            typ = generate_typst(model)
            pdf = generate_pdf(model, typ)
            print(f"[PASS] Theme {theme:20} -> PDF {pdf.stat().st_size} bytes")
        except Exception as e:
            print(f"[FAIL] Theme {theme:20} -> {e}")
