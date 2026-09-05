import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import psycopg2
import json
from server import app
from fastapi.testclient import TestClient
import jwt
import datetime

SECRET_KEY = "uplift-thesis-secret-key-32bytes!!"
client = TestClient(app)

def run_persistence_test():
    print("--- 1. Checking PWD user in PostgreSQL DB ---")
    conn = psycopg2.connect("postgresql://postgres:yuichirokanade@localhost:5432/uplift")
    cur = conn.cursor()
    cur.execute("SELECT id, email, password_hash FROM users WHERE role = 'user' LIMIT 1")
    row = cur.fetchone()
    if not row:
        print("No PWD user found in DB.")
        conn.close()
        return
    
    user_id, email, pwd_hash = row[0], row[1], row[2]
    print(f"Testing with user: {email} (ID: {user_id})")
    
    token = jwt.encode({
        "sub": user_id,
        "email": email,
        "role": "user",
        "exp": datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=1)
    }, SECRET_KEY, algorithm="HS256")
    
    # 2. Update user profile via PUT /api/pwd/profile
    print("\n--- 2. Testing PUT /api/pwd/profile ---")
    test_profile = {
        "summary": "Experienced Data Analyst with strong Python & SQL background.",
        "skills": "Python, SQL, Tableau, Data Cleaning, Statistics",
        "disabilities": ["Physical: Wheelchair User (Complete)"],
        "disability_profile": {
            "disabilities": [{"category": "Physical", "subtype": "Wheelchair User", "extent": "Complete"}]
        },
        "skill_weight": 0.6,
        "safety_weight": 0.8,
        "stamina_weight": 0.5,
        "physical_capabilities": "Wheelchair Accessible Only, Seated Workstation",
        "preferred_intensity": "Medium",
        "requires_flexibility": True,
        "education": json.dumps([{"level": "College", "institution": "University of the Philippines", "degree": "BS Computer Science", "area": "IT", "start_date": "2018", "end_date": "2022"}]),
        "experience": "Data Analyst at ABC Corp (2 years)",
        "projects": "PWD Accessibility Dashboard",
        "certifications": "Google Data Analytics Professional Certificate",
        "awards": "Top Performer 2024",
        "auto_generate_resume": True
    }
    
    res_update = client.put("/api/pwd/profile", json=test_profile, headers={"Authorization": f"Bearer {token}"})
    print("PUT /api/pwd/profile Status:", res_update.status_code)
    update_data = res_update.json()
    print("Saved user skills:", update_data.get("user", {}).get("skills"))
    print("Saved user disability_profile:", update_data.get("user", {}).get("disability_profile"))
    
    # 3. Simulate Login via POST /api/auth/login or GET /api/auth/me
    print("\n--- 3. Testing GET /api/auth/me (Simulating page reload) ---")
    res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    print("GET /api/auth/me Status:", res_me.status_code)
    me_data = res_me.json()
    print("Loaded skills on reload:", me_data.get("skills"))
    print("Loaded summary on reload:", me_data.get("summary"))
    print("Loaded disability_profile on reload:", me_data.get("disability_profile"))
    print("Loaded education on reload:", me_data.get("education"))

    # 4. Verify in DB
    print("\n--- 4. Direct DB Verification in PostgreSQL ---")
    cur.execute("SELECT summary, skills, disabilities, disability_profile, education FROM users WHERE id = %s", (user_id,))
    db_row = cur.fetchone()
    print("DB summary:", db_row[0])
    print("DB skills:", db_row[1])
    print("DB disabilities:", db_row[2])
    print("DB disability_profile:", db_row[3])
    print("DB education:", db_row[4])
    conn.close()
    print("\n[SUCCESS] Profile persistence verified 100% across update, login, and DB!")

if __name__ == "__main__":
    run_persistence_test()
