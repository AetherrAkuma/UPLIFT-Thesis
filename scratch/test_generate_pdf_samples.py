import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import json
import base64
from render_engine import generate_resume

sample_profile = {
    "name": "Reymar Candidate",
    "email": "reymar@example.com",
    "phone": "+63 912 345 6789",
    "location": "Manila, Philippines",
    "summary": "Seeking Remote Work. Entry-Level. Passionate Learner. Detail-Oriented",
    "education": json.dumps([{
        "school": "Eulogio Amang Rodriguez Institute of Science and Technology",
        "degree": "BS",
        "field": "Information Technology",
        "start_date": "2023-06",
        "end_date": "present"
    }]),
    "experience": json.dumps([{
        "company": "Makati BPO Solutions",
        "position": "Customer Support Specialist",
        "start_date": "2022-01",
        "end_date": "2023-05",
        "highlights": [
            "Handled customer inquiries with 98% satisfaction rating.",
            "Assisted team with document management and ticket resolution."
        ]
    }]),
    "skills": "JavaScript, Python, React, Technical Support, Data Entry"
}

for th in ["classic", "sb2nov", "engineeringresumes"]:
    pdf_b64 = generate_resume(sample_profile, theme=th)
    if pdf_b64:
        with open(f"scratch/resume_{th}.pdf", "wb") as f:
            f.write(base64.b64decode(pdf_b64))
        print(f"Saved scratch/resume_{th}.pdf successfully")
