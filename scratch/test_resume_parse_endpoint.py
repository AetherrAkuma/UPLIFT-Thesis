import os
import sys
import io

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from server import app, parse_resume_document

def test_resume_parser_function():
    sample_pdf = os.path.join(os.path.dirname(__file__), "resume_classic.pdf")
    assert os.path.exists(sample_pdf), f"Sample resume not found: {sample_pdf}"
    
    extracted = parse_resume_document(sample_pdf)
    print("Direct parse_resume_document output:")
    print("  Name:", extracted.get("name"))
    print("  Skills:", extracted.get("skills"))
    print("  Experience lines:", len(extracted.get("experience", "").split("\n")))
    print("  Summary:", extracted.get("summary"))
    
    assert extracted.get("name"), "Name was not extracted"
    assert "Python" in extracted.get("skills", "") or "Javascript" in extracted.get("skills", ""), "Skills missing"
    print("[PASS] Direct parser functional test passed.\n")

if __name__ == "__main__":
    test_resume_parser_function()
    print("All resume parsing tests passed!")
