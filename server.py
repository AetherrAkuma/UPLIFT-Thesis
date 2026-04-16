from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import json
import uuid
import sys
import os
import re
import warnings
import logging
import numpy as np
import faiss
import torch

# ==========================================
# 0. SUPPRESS ALL HUGGINGFACE WARNINGS
# ==========================================
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["TRANSFORMERS_VERBOSITY"] = "error" 
warnings.filterwarnings("ignore")
logging.getLogger("sentence_transformers").setLevel(logging.ERROR)

# The Ultimate Silencer for "layers were not sharded"
try:
    import transformers
    transformers.logging.set_verbosity_error()
except ImportError:
    pass

from sentence_transformers import SentenceTransformer

# ==========================================
# 1. APPLICATION & AI SETUP
# ==========================================
app = FastAPI(title="UPLIFT AI Prototype Backend", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("[INFO] Initializing UPLIFT AI Semantic Engine...")
try:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    CACHE_DIR = "./model_cache"
    os.makedirs(CACHE_DIR, exist_ok=True)
    
    # Load model and cache it locally
    model = SentenceTransformer('all-MiniLM-L12-v2', cache_folder=CACHE_DIR).to(device)
    print(f"[INFO] all-MiniLM-L12-v2 loaded successfully on {device} (Cached locally).")
except Exception as e:
    print(f"[ERROR] Failed to load Semantic Engine: {e}")
    sys.exit(1)

# ==========================================
# 2. SQLITE DATABASE SETUP
# ==========================================
DB_FILE = "uplift_prototype.db"

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            employer_name TEXT,
            job_title TEXT,
            job_description TEXT,
            physical_requirements TEXT,
            status TEXT DEFAULT 'pending',
            embedding TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db() 

# ==========================================
# 3. PYDANTIC DATA MODELS
# ==========================================
class JobSubmission(BaseModel):
    employer_name: str
    job_title: str
    job_description: str
    physical_requirements: str

class PWDProfile(BaseModel):
    name: str
    disability_type: str
    physical_capabilities: str 
    skills: str 

# ==========================================
# 4. BACKGROUND TASKS
# ==========================================
def generate_job_embedding(job_id: str, physical_requirements: str):
    try:
        embedding_tensor = model.encode(physical_requirements, convert_to_tensor=False)
        embedding_list = embedding_tensor.tolist() 
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE jobs SET status = 'approved', embedding = ? WHERE id = ?", 
            (json.dumps(embedding_list), job_id)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[ERROR] Background Vectorization Failed for {job_id}: {e}")

# ==========================================
# 5. CORE ENDPOINTS
# ==========================================

@app.post("/api/employer/submit-job")
async def employer_submit_job(job: JobSubmission):
    job_id = str(uuid.uuid4())
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO jobs (id, employer_name, job_title, job_description, physical_requirements, status) VALUES (?, ?, ?, ?, ?, 'pending')",
        (job_id, job.employer_name, job.job_title, job.job_description, job.physical_requirements)
    )
    conn.commit()
    conn.close()
    return {"message": "Job submitted successfully.", "job_id": job_id}


@app.get("/api/admin/jobs/{status}")
async def get_jobs_by_status(status: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, employer_name, job_title, physical_requirements, status FROM jobs WHERE status = ?", (status,))
    jobs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"count": len(jobs), "jobs": jobs}


@app.post("/api/admin/approve-job/{job_id}")
async def admin_approve_job(job_id: str, background_tasks: BackgroundTasks):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT physical_requirements FROM jobs WHERE id = ? AND status = 'pending'", (job_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Pending job not found.")
    background_tasks.add_task(generate_job_embedding, job_id, row['physical_requirements'])
    return {"message": "Job verified!"}


@app.post("/api/pwd/match")
async def pwd_suitability_match(profile: PWDProfile):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE status = 'approved' AND embedding IS NOT NULL")
    approved_jobs = [dict(row) for row in cursor.fetchall()]
    conn.close()

    if not approved_jobs:
        return {"message": "No approved jobs available.", "matches": []}

    # --- ADVANCED HEURISTIC HELPERS ---
    def extract_hours(text):
        match = re.search(r'(\d+)\s*hour', text.lower())
        return int(match.group(1)) if match else None

    def extract_required_skills(desc_text):
        # Extracts specific skills listed after the word "skills:" in job descriptions
        match = re.search(r'skills?:\s*([a-z0-9,\s]+)', desc_text.lower())
        if match:
            raw_skills = re.split(r'[,\s]+', match.group(1))
            return set([s.strip() for s in raw_skills if len(s) > 2])
        return set()

    def generate_detailed_insights(semantic_score, user_hours, job_hours, matched_skills, missing_skills, disability_type):
        insights = []
        
        # 1. Environmental & Physical Analytics
        if semantic_score >= 85:
            insights.append(f"<b>Environmental Alignment:</b> The AI calculates an excellent {semantic_score:.1f}% physical match. Because you identified as having an {disability_type} disability, this high vector score strongly suggests the employer's facilities pose minimal friction to your specific mobility or sensory needs.")
        elif semantic_score >= 60:
            insights.append(f"<b>Favorable Environment:</b> At a {semantic_score:.1f}% match, this job is generally safe. However, given your {disability_type} profile, you may want to request minor workplace accommodations (e.g., specialized desk setups) to ensure complete comfort.")
        else:
            insights.append(f"<b>Borderline Physical Match:</b> This role meets the minimum safety threshold, but the physical demands might require formal workplace accommodations. Please review the employer's exact environmental requirements carefully.")
            
        # 2. Workload & Stamina Analytics
        if user_hours and job_hours:
            if user_hours >= job_hours:
                insights.append(f"<b>Stamina Verification:</b> The employer requires a {job_hours}-hour shift, which falls safely within your documented {user_hours}-hour working capacity. Physical burnout risk for this role is mathematically low.")
            else:
                insights.append(f"<b>Stamina Discrepancy:</b> Caution is advised. The role demands {job_hours} hours per shift, but your profile lists a maximum of {user_hours} hours. Consider negotiating a part-time arrangement or split shifts with the HR department.")
        else:
            insights.append("<b>Stamina Unverified:</b> Specific working hours were not provided. Ensure the shift length aligns with your personal fatigue limits before accepting.")
                
        # 3. Competency & Skill Gap Analysis
        if not missing_skills and matched_skills:
            insights.append(f"<b>Complete Skill Alignment:</b> You possess the core competencies identified by the employer ({', '.join(matched_skills[:3])}), making you a highly competitive candidate for immediate onboarding.")
        elif missing_skills and matched_skills:
            insights.append(f"<b>Skill Gap Detected:</b> While your background in [{', '.join(matched_skills[:2])}] is valuable, the employer specifically requires proficiency in [{', '.join(missing_skills[:3])}]. Upskilling in these missing areas via PESO training programs will significantly elevate your candidacy.")
        else:
            insights.append("<b>Skill Gap Detected:</b> The employer is seeking highly specific technical competencies that are currently missing from your profile. Major upskilling is recommended before applying.")
            
        # 4. Actionable Interview Advice (Based on Disability Type)
        if "Orthopedic" in disability_type:
            insights.append("<b>Things to Consider (Orthopedic):</b> During the interview, explicitly ask about elevator maintenance reliability, the exact width of desk spaces, and the proximity of accessible restrooms to your workstation.")
        elif "Visual" in disability_type:
            insights.append("<b>Things to Consider (Visual):</b> Verify if the employer provides screen-reading software (like NVDA or JAWS) or if you are permitted to install your own assistive software on company hardware.")
        elif "Hearing" in disability_type:
            insights.append("<b>Things to Consider (Hearing):</b> Check if the company facility uses visual alarm systems for emergencies and if team meetings are conducted with closed-captioning tools.")
        elif "Psychosocial" in disability_type:
            insights.append("<b>Things to Consider (Psychosocial):</b> Ask the employer about designated 'quiet zones' in the office, remote work flexibility, and their official policies on mental health days.")

        return insights

    # --- 1. PREPARE FAISS INDEX ---
    job_vectors = [json.loads(job['embedding']) for job in approved_jobs]
    job_vectors_np = np.array(job_vectors).astype('float32')
    faiss.normalize_L2(job_vectors_np)
    d = 384 
    index = faiss.IndexFlatIP(d)
    index.add(job_vectors_np)

    # --- 2. VECTORIZE PWD PROFILE ---
    pwd_context = f"Disability Type: {profile.disability_type}. Capabilities: {profile.physical_capabilities}"
    pwd_vector_np = model.encode(pwd_context, convert_to_numpy=True).astype('float32')
    pwd_vector_np = np.expand_dims(pwd_vector_np, axis=0) 
    faiss.normalize_L2(pwd_vector_np)

    # --- 3. FAISS SEARCH EXECUTION ---
    k = len(approved_jobs) 
    distances, indices = index.search(pwd_vector_np, k)

    # --- 4. HYBRID SCORING & FILTERING ---
    # Clean user skills into a set
    pwd_skills_set = set([s.strip().lower() for s in profile.skills.replace(".", "").split(",") if s.strip()])
    matches = []
    user_hours = extract_hours(profile.physical_capabilities)
    
    for i in range(k):
        job_idx = indices[0][i]
        cos_sim = distances[0][i] 
        job = approved_jobs[job_idx]
        
        # Base Semantic Score from FAISS (0 to 100)
        semantic_score = max(0.0, min(100.0, float(cos_sim) * 100))
        
        job_hours = extract_hours(job['physical_requirements'])
        if user_hours and job_hours:
            if user_hours >= job_hours:
                semantic_score = min(100.0, semantic_score + 25.0) 
            else:
                semantic_score = max(0.0, semantic_score - 40.0) 
        
        # Skill Gap Math
        job_req_skills = extract_required_skills(job['job_description'])
        if job_req_skills:
            overlap = list(pwd_skills_set.intersection(job_req_skills))
            missing_skills = list(job_req_skills - pwd_skills_set)
            keyword_score = min(100.0, (len(overlap) / max(1, len(job_req_skills))) * 100)
        else:
            # Fallback if the employer didn't explicitly use the word "skills:"
            job_desc_set = set(re.findall(r'\b\w+\b', job['job_description'].lower()))
            overlap = list(pwd_skills_set.intersection(job_desc_set))
            missing_skills = []
            keyword_score = min(100.0, (len(overlap) / 3) * 100) 
        
        final_accessibility_percentage = (semantic_score * 0.70) + (keyword_score * 0.30)
        
        # Generate the new highly-detailed insights
        ai_insights = generate_detailed_insights(semantic_score, user_hours, job_hours, overlap, missing_skills, profile.disability_type)
        
        if final_accessibility_percentage >= 60.0:
            matches.append({
                "job_id": job['id'],
                "employer": job['employer_name'],
                "job_title": job['job_title'],
                "physical_requirements": job['physical_requirements'],
                "matched_skills": overlap,
                "missing_skills": missing_skills,
                "metrics": {
                    "semantic_score": round(semantic_score, 1),
                    "keyword_score": round(keyword_score, 1),
                    "final_accessibility_percentage": round(final_accessibility_percentage, 1)
                },
                "ai_insights": ai_insights
            })
            
    matches.sort(key=lambda x: x["metrics"]["final_accessibility_percentage"], reverse=True)
    return {"applicant": profile.name, "total_safe_matches": len(matches), "matches": matches}

@app.get("/api/demo/seed")
async def seed_demo_data(background_tasks: BackgroundTasks):
    demo_jobs = [
        {"employer_name": "Makati BPO Solutions", "job_title": "Customer Service Representative", "job_description": "Handle incoming calls and emails. Required skills: communication, typing, english.", "physical_requirements": "Requires sitting at a desk for 8 hours. Wheelchair accessible office with ramps."},
        {"employer_name": "Quezon City Logistics", "job_title": "Warehouse Inventory Clerk", "job_description": "Manage inventory stock via database. Required skills: organization, inventory, computer.", "physical_requirements": "Requires standing for long periods and lifting boxes up to 10kg."}
    ]
    conn = get_db_connection()
    cursor = conn.cursor()
    for job in demo_jobs:
        job_id = str(uuid.uuid4())
        cursor.execute("INSERT INTO jobs (id, employer_name, job_title, job_description, physical_requirements, status) VALUES (?, ?, ?, ?, ?, 'pending')", (job_id, job['employer_name'], job['job_title'], job['job_description'], job['physical_requirements']))
        background_tasks.add_task(generate_job_embedding, job_id, job['physical_requirements'])
    conn.commit()
    conn.close()
    return {"message": "Demo seeded!"}