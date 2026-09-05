import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import json

def _clean_education_degree_and_area(degree: str, area: str):
    degree = (degree or "").strip()
    area = (area or "").strip()

    if not degree and not area:
        return "", "General Studies"
    if not degree and area:
        return _clean_education_degree_and_area(area, "")
    if degree and not area:
        # Check prefixes
        for prefix, deg_name in [
            ("bachelor of science in ", "Bachelor of Science"),
            ("bachelor of arts in ", "Bachelor of Arts"),
            ("bachelor of science ", "Bachelor of Science"),
            ("bachelor of arts ", "Bachelor of Arts"),
            ("bs in ", "Bachelor of Science"),
            ("ba in ", "Bachelor of Arts"),
            ("bs ", "Bachelor of Science"),
            ("ba ", "Bachelor of Arts"),
            ("master of science in ", "Master of Science"),
            ("master of arts in ", "Master of Arts"),
            ("ms in ", "Master of Science"),
            ("ms ", "Master of Science"),
            ("doctor of philosophy in ", "PhD"),
            ("phd in ", "PhD"),
            ("associate in ", "Associate Degree"),
            ("associate of ", "Associate Degree"),
            ("diploma in ", "Diploma"),
            ("certificate in ", "Certificate"),
            ("senior high school - ", "Senior High School"),
            ("senior high school ", "Senior High School"),
            ("high school ", "High School")
        ]:
            if degree.lower().startswith(prefix):
                return deg_name, degree[len(prefix):].strip()
        return "", degree

    # If both degree and area are supplied
    if degree.lower() == area.lower() or area.lower() in degree.lower():
        for prefix, deg_name in [
            ("bachelor of science in ", "Bachelor of Science"),
            ("bachelor of arts in ", "Bachelor of Arts"),
            ("bachelor of science ", "Bachelor of Science"),
            ("bachelor of arts ", "Bachelor of Arts"),
            ("bs in ", "Bachelor of Science"),
            ("ba in ", "Bachelor of Arts"),
            ("bs ", "Bachelor of Science"),
            ("ba ", "Bachelor of Arts"),
            ("master of science in ", "Master of Science"),
            ("master of arts in ", "Master of Arts"),
            ("ms in ", "Master of Science"),
            ("ms ", "Master of Science"),
            ("doctor of philosophy in ", "PhD"),
            ("phd in ", "PhD"),
            ("associate in ", "Associate Degree"),
            ("associate of ", "Associate Degree"),
            ("diploma in ", "Diploma"),
            ("certificate in ", "Certificate"),
            ("senior high school - ", "Senior High School"),
            ("senior high school ", "Senior High School"),
            ("high school ", "High School")
        ]:
            if degree.lower().startswith(prefix):
                clean_area = degree[len(prefix):].strip() or area
                return deg_name, clean_area
        return "", area

    return degree, area

test_cases = [
    ("BS Information Technology", "BS Information Technology"),
    ("BS Information Technology", "Information Technology"),
    ("Bachelor of Science in Information Technology", ""),
    ("BS in Computer Science", ""),
    ("BS", "Information Technology"),
    ("", "BS Information Technology")
]

for d, a in test_cases:
    cd, ca = _clean_education_degree_and_area(d, a)
    print(f"Input: degree='{d}', area='{a}' -> Result: degree='{cd}', area='{ca}'")
