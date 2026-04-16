from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sentence_transformers import SentenceTransformer, util
import torch
import sqlite3
import json
import uuid
import sys
import os

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
    # Upgraded L12 model for high semantic accuracy (Chapter 1 Aligned)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = SentenceTransformer('all-MiniLM-L12-v2').to(device)
    print(f"[INFO] all-MiniLM-L12-v2 loaded successfully on {device}.")
except Exception as e:
    print(f"[ERROR] Failed to load Semantic Matching Engine: {e}")
    sys.exit(1)

# ==========================================
# 2. SQLITE DATABASE SETUP (PROTOTYPE PERSISTENCE)
# ==========================================
# Simulates the PostgreSQL pgvector environment safely for local presentations
DB_FILE = "uplift_prototype.db"

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    # Create jobs table. 'embedding' will store the AI vector as a JSON string
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
    print("[INFO] SQLite Database Initialized.")

init_db() # Run on startup

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
# 4. BACKGROUND TASKS (AI AUTOMATION)
# ==========================================
def generate_job_embedding(job_id: str, physical_requirements: str):
    """
    Simulates the async pgvector pipeline. Processes the 384-d vector 
    in the background to prevent LGU Admin dashboard lag.
    """
    try:
        # Generate the sentence embedding
        embedding_tensor = model.encode(physical_requirements, convert_to_tensor=False)
        embedding_list = embedding_tensor.tolist() # Convert to standard python list
        
        # Update the database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE jobs 
            SET status = 'approved', embedding = ? 
            WHERE id = ?
            """, 
            (json.dumps(embedding_list), job_id)
        )
        conn.commit()
        conn.close()
        print(f"[INFO] AI Embedding generated and Job {job_id} is now APPROVED.")
    except Exception as e:
        print(f"[ERROR] Background Vectorization Failed for {job_id}: {e}")

# ==========================================
# 5. CORE SYSTEM ENDPOINTS
# ==========================================

@app.post("/api/employer/submit-job")
async def employer_submit_job(job: JobSubmission):
    """Step 1: Employer submits a job (Defaults to Pending)."""
    job_id = str(uuid.uuid4())
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO jobs (id, employer_name, job_title, job_description, physical_requirements, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
        """,
        (job_id, job.employer_name, job.job_title, job.job_description, job.physical_requirements)
    )
    conn.commit()
    conn.close()
    
    return {"message": "Job submitted successfully. Pending NCDA Admin verification.", "job_id": job_id}


@app.get("/api/admin/jobs/{status}")
async def get_jobs_by_status(status: str):
    """Step 2: Admin views jobs (status = 'pending' or 'approved')."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, employer_name, job_title, physical_requirements, status FROM jobs WHERE status = ?", (status,))
    jobs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"count": len(jobs), "jobs": jobs}


@app.post("/api/admin/approve-job/{job_id}")
async def admin_approve_job(job_id: str, background_tasks: BackgroundTasks):
    """Step 3: Admin approves the job, triggering AI vectorization."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT physical_requirements FROM jobs WHERE id = ? AND status = 'pending'", (job_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Pending job not found or already approved.")
    
    # Trigger background AI task
    background_tasks.add_task(generate_job_embedding, job_id, row['physical_requirements'])
    
    return {"message": "Job verified! AI is currently generating semantic embeddings in the background."}


@app.post("/api/pwd/match")
async def pwd_suitability_match(profile: PWDProfile):
    """
    Step 4: The Core UPLIFT AI Engine.
    Implements the exact "Hybrid Scoring System" defined in Chapter 1.
    (70% Semantic Vector Similarity + 30% Keyword Matching)
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    # Fetch only approved jobs that have vector embeddings
    cursor.execute("SELECT * FROM jobs WHERE status = 'approved' AND embedding IS NOT NULL")
    approved_jobs = [dict(row) for row in cursor.fetchall()]
    conn.close()

    if not approved_jobs:
        return {"message": "No approved jobs available.", "matches": []}

    # 1. Vectorize the PWD's physical capabilities
    pwd_vector = model.encode(profile.physical_capabilities, convert_to_tensor=True)
    pwd_skills_set = set(profile.skills.lower().replace(",", "").split())
    
    matches = []
    
    for job in approved_jobs:
        # Load the stored job vector
        job_vector = torch.tensor(json.loads(job['embedding'])).to(device)
        
        # --- A. SEMANTIC SIMILARITY (Physical Match) ---
        cos_sim = util.cos_sim(pwd_vector, job_vector).item()
        semantic_score = max(0.0, min(100.0, cos_sim * 100))
        
        # --- B. KEYWORD MATCHING BONUS (Skills Match) ---
        job_desc_set = set(job['job_description'].lower().replace(",", "").split())
        overlap = pwd_skills_set.intersection(job_desc_set)
        
        # Calculate keyword score (cap at 100)
        # If they match 3+ relevant skills, they get a strong bonus
        keyword_score = min(100.0, (len(overlap) / 3) * 100) 
        
        # --- C. HYBRID SCORING CALCULATION (From Chapter 1) ---
        # 70% Weight to Physical Semantic Safety, 30% Weight to Skill Keywords
        final_accessibility_percentage = (semantic_score * 0.70) + (keyword_score * 0.30)
        
        # Filter Threshold: Only show highly suitable jobs (>= 60%)
        if final_accessibility_percentage >= 60.0:
            matches.append({
                "job_id": job['id'],
                "employer": job['employer_name'],
                "job_title": job['job_title'],
                "physical_requirements": job['physical_requirements'],
                "matched_skills": list(overlap),
                "metrics": {
                    "semantic_score": round(semantic_score, 1),
                    "keyword_score": round(keyword_score, 1),
                    "final_accessibility_percentage": round(final_accessibility_percentage, 1)
                }
            })
            
    # Sort by highest final percentage first
    matches.sort(key=lambda x: x["metrics"]["final_accessibility_percentage"], reverse=True)
    
    return {
        "applicant": profile.name,
        "total_safe_matches": len(matches),
        "matches": matches
    }


# ==========================================
# 6. DEMO HELPER ROUTINES
# ==========================================
@app.get("/api/demo/seed")
async def seed_demo_data(background_tasks: BackgroundTasks):
    """Instantly inject realistic Metro Manila jobs for your presentation."""
    demo_jobs = [
        {
            "employer_name": "Makati BPO Solutions",
            "job_title": "Customer Service Representative",
            "job_description": "Handle incoming calls and emails. Required skills: communication, typing, english, computer.",
            "physical_requirements": "Requires sitting at a desk for 8 hours. Wheelchair accessible office with ramps and elevator. No heavy lifting required."
        },
        {
            "employer_name": "Quezon City Logistics",
            "job_title": "Warehouse Inventory Clerk",
            "job_description": "Manage inventory stock. Required skills: organization, inventory, sorting, computer.",
            "physical_requirements": "Requires standing for long periods, navigating narrow aisles, and lifting boxes up to 10kg occasionally."
        }
    ]
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    for job in demo_jobs:
        job_id = str(uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO jobs (id, employer_name, job_title, job_description, physical_requirements, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
            """,
            (job_id, job['employer_name'], job['job_title'], job['job_description'], job['physical_requirements'])
        )
        # Trigger AI approval automatically for the demo
        background_tasks.add_task(generate_job_embedding, job_id, job['physical_requirements'])

    conn.commit()
    conn.close()
    
    return {"message": "Realistic Metro Manila demo data seeded and AI processing started!"}