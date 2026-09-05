import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import json
from render_engine import _build_yaml, generate_resume

sample_profile = {
    "name": "Reymar Candidate",
    "email": "reymar@example.com",
    "phone": "+63 912 345 6789",
    "location": "Manila, Philippines",
    "summary": "Seeking Remote Work. Entry-Level. Passionate Learner. Detail-Oriented",
    "education": json.dumps([{
        "school": "Eulogio Amang Rodriguez Institute of Science and Technology",
        "degree": "BS Information Technology",
        "field": "Information Technology",
        "start_date": "2023-06",
        "end_date": "present"
    }]),
    "experience": json.dumps([{
        "company": "Professional Experience",
        "position": "Admin Assistant",
        "start_date": "2022-01",
        "end_date": "2023-05"
    }]),
    "skills": "JavaScript, Python, React, Data Entry"
}

for theme in ["classic", "sb2nov", "engineeringresumes", "moderncv", "engineeringclassic"]:
    yaml_txt = _build_yaml(sample_profile, theme)
    print(f"\n================ THEME: {theme} ================")
    print(yaml_txt)
    b64 = generate_resume(sample_profile, theme=theme)
    print(f"Generated PDF base64 length: {len(b64) if b64 else 'FAILED'}")
