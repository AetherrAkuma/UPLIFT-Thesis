from fastapi import FastAPI, BackgroundTasks, HTTPException
from typing import List
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
from sentence_transformers import SentenceTransformer, CrossEncoder
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

# ==========================================
# 1. APPLICATION & AI SETUP
# ==========================================
app = FastAPI(title="UPLIFT AI Data Engine", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("[INFO] Initializing UPLIFT AI Engine Cluster...")
try:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    CACHE_DIR = "./model_cache"
    os.makedirs(CACHE_DIR, exist_ok=True)
    
    # 1. Load Bi-Encoder (Semantic Search)
    model = SentenceTransformer('all-MiniLM-L12-v2', cache_folder=CACHE_DIR).to(device)
    print(f"[INFO] Bi-Encoder loaded successfully on {device}.")

    # 1.5 Load Cross-Encoder (Re-ranking)
    print("[INFO] Loading Cross-Encoder (ms-marco-MiniLM-L-6-v2)...")
    cross_model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2', cache_folder=CACHE_DIR, device=device)
    print("[INFO] Cross-Encoder loaded.")

    # 2. Load Generative Data Analysis Engine (Flan-T5-Base)
    # Base is 3x larger than Small, providing much better reasoning/analysis.
    print("[INFO] Loading Generative Data Engine (Flan-T5-Base)...")
    tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-base", cache_dir=CACHE_DIR)
    gen_model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-base", cache_dir=CACHE_DIR).to(device)
    print("[INFO] Data Engine ready.")
except Exception as e:
    print(f"[ERROR] Failed to load AI Engines: {e}")
    sys.exit(1)

# ==========================================
# 1.5 EXPERT VOCATIONAL KNOWLEDGE BASE
# ==========================================
EXPERT_KNOWLEDGE = {
    "Physical": {
        "context": "Physical disability includes impairments to the skeletal, muscular, or nervous systems that affect mobility, dexterity, or physical capacity (e.g., wheelchair users, amputees, or those with chronic pain).",
        "hinder": "Stationary desk work for 8+ hours can lead to significant pressure-point fatigue and circulation issues for individuals with lower-limb or spinal conditions.",
        "benefit": "Desk-bound environments eliminate the high-risk hazards of warehouse or retail floors, such as uneven surfaces or heavy lifting requirements.",
        "analysis": "For a Physical profile, the primary focus is on 'Static Load Management'. While the job is physically safe, the repetition of sitting requires specific workstation modifications.",
        "tip": "Negotiate for frequent 'micro-breaks' to perform stretching or position changes, and ensure the workspace has a 360-degree clearance for any mobility aids.",
        "strengths": ["Mobility-Friendly Environment", "Static Load Suitability", "Ergonomic Potential"],
        "barriers": ["Prolonged Physical Stasis", "Navigation Constraints", "Repetitive Motion Risk"]
    },
    "Visual": {
        "context": "Visual disability ranges from low vision to total blindness, affecting the ability to process information visually. It often involves reliance on screen readers, braille, or high-contrast interfaces.",
        "hinder": "Extended screen time can cause intense eye strain; however, the main barrier is often non-accessible internal software that lacks ARIA labeling.",
        "benefit": "High-proficiency in keyboard-only navigation and screen-reading software often leads to faster data entry speeds than traditional mouse users.",
        "analysis": "Visual impairment suitability hinges on 'Software Accessibility'. The role is highly suitable if the digital environment supports assistive technology.",
        "tip": "Ask for a 'Tech Audit' of the internal CRM systems during the onboarding phase to ensure compatibility with your preferred screen reader.",
        "strengths": ["Screen-Reader Ready", "Keyboard-Efficiency Focus", "Digital Accessibility"],
        "barriers": ["Unlabeled Visual Cues", "High Visual Load", "Non-ARIA Software"]
    },
    "Hearing": {
        "context": "Hearing disability includes deafness or hard-of-hearing conditions. Communication often relies on sign language, captioning, or written text instead of auditory cues.",
        "hinder": "In multi-channel BPO environments, auditory-only cues or uncaptioned video meetings can lead to communication gaps with team leads.",
        "benefit": "Excellent focus in high-noise environments and often superior written communication skills for email or chat-based support roles.",
        "analysis": "Suitability for Hearing profiles is centered on 'Information Redundancy'—ensuring all auditory info is also provided in visual formats.",
        "tip": "Request that all team huddles or training videos include live-captioning or a written summary to ensure 100% information retention.",
        "strengths": ["Quiet-Focus Environment", "Visual-Communication Culture", "Text-Based Workflow"],
        "barriers": ["Auditory-Only Cues", "Uncaptioned Media", "High Auditory Demand"]
    },
    "Learning": {
        "context": "Learning disabilities include neurodivergent conditions like Autism, ADHD, and Dyslexia. These affect how information is processed, organized, and responded to, often involving unique sensory needs.",
        "hinder": "Environments with complex, unwritten social rules or high sensory overload (noise/bright lights) can lead to cognitive exhaustion or sensory meltdowns.",
        "benefit": "Exceptional ability to hyper-focus on specific tasks, high attention to detail, and often unique 'out-of-the-box' problem-solving perspectives.",
        "analysis": "Suitability depends on 'Sensory and Social Clarity'—clear instructions, predictable environments, and sensory-friendly workspaces are key.",
        "tip": "Request written instructions for all tasks and clarify the 'definition of done' to avoid ambiguity in performance expectations.",
        "strengths": ["High-Detail Processing", "Hyper-Focus Capability", "Creative Problem Solving"],
        "barriers": ["Sensory Overload", "Ambiguous Social Rules", "Unexpected Schedule Changes"]
    },
    "Intellectual": {
        "context": "Intellectual disability involves limitations in cognitive functioning and adaptive behaviors. It may affect learning speed and social interaction, but individuals often excel in structured, repetitive roles.",
        "hinder": "Rapidly changing environments with high-speed multitasking requirements can be overwhelming without structured support or job-coaching.",
        "benefit": "High reliability, strong adherence to safety protocols, and a positive impact on workplace morale and team cohesion.",
        "analysis": "Success is driven by 'Task Chunking'—breaking down complex workflows into repeatable, manageable steps with visual aids.",
        "tip": "Ask for a 'Task Checklist' with visual icons or a job coach to help master the initial routine during the first month.",
        "strengths": ["Task Reliability", "Protocol Adherence", "Team Morale Booster"],
        "barriers": ["High-Speed Multitasking", "Complex Decision Paths", "Abstract Instruction Sets"]
    },
    "Psychosocial": {
        "context": "Psychosocial disability relates to mental health conditions like Bipolar Disorder, Depression, Anxiety, or PTSD. It can affect energy levels, social interaction, and stress tolerance.",
        "hinder": "High-stress deadlines or high-conflict environments can trigger or exacerbate symptoms of anxiety or mood fluctuations.",
        "benefit": "Often possesses high emotional intelligence, resilience, and a deep understanding of workplace empathy and mental wellness.",
        "analysis": "The core factor is 'Emotional Safety'—a culture that values mental health and provides flexibility for self-care routines.",
        "tip": "Inquire about 'Mental Health Days' or flexible start times that can accommodate medical appointments or fluctuating energy levels.",
        "strengths": ["High Emotional Intelligence", "Resilient Perspective", "Empathetic Communication"],
        "barriers": ["High-Conflict Situations", "Rigid Performance Pressure", "Social Exhaustion"]
    },
    "Chronic_Illness": {
        "context": "This category covers non-apparent disabilities such as Cancer, rare diseases, or speech impairments. These often involve fluctuating energy levels, medical scheduling needs, or specific communication tools.",
        "hinder": "Physical fatigue from treatments (cancer/rare disease) or frustration in fast-paced verbal-only communication (speech impairment).",
        "benefit": "Extremely high adaptability, persistence, and specialized technical knowledge often gained through managing complex health/communication needs.",
        "analysis": "Requires 'Biological/Communication Flexibility'—support for medical appointments, fatigue management, and multi-modal communication tools.",
        "tip": "Discuss the use of text-to-speech tools or email-first communication if speech is a barrier, and request 'Energy-Budget' flexibility.",
        "strengths": ["Exceptional Adaptability", "Persistent Work Ethic", "Multi-Modal Communication"],
        "barriers": ["Physical Fatigue Cycles", "Verbal-Only Communication", "Rigid Medical Scheduling"]
    }
}

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
            embedding TEXT,
            task_intensity TEXT DEFAULT 'Medium',
            has_flexibility INTEGER DEFAULT 0,
            structured_skills TEXT DEFAULT '',
            employer_type TEXT DEFAULT 'Private',
            salary_range TEXT,
            benefits TEXT,
            job_type TEXT DEFAULT 'Full-time',
            location TEXT
        )
    """)
    # Migration for existing DBs
    new_cols = {
        "employer_type": "TEXT DEFAULT 'Private'",
        "salary_range": "TEXT",
        "benefits": "TEXT",
        "job_type": "TEXT DEFAULT 'Full-time'",
        "location": "TEXT",
        "accessibility_features": "TEXT DEFAULT ''",
        "work_environment": "TEXT DEFAULT 'Indoor'",
        "work_tempo": "TEXT DEFAULT 'Moderate'"
    }
    for col, definition in new_cols.items():
        try: cursor.execute(f"ALTER TABLE jobs ADD COLUMN {col} {definition}")
        except: pass
    
    # Data Sanity: Ensure no NULLs in new critical columns for old records
    cursor.execute("UPDATE jobs SET employer_type = 'Private' WHERE employer_type IS NULL")
    cursor.execute("UPDATE jobs SET work_environment = 'Indoor' WHERE work_environment IS NULL")
    cursor.execute("UPDATE jobs SET work_tempo = 'Moderate' WHERE work_tempo IS NULL")
    cursor.execute("UPDATE jobs SET accessibility_features = '' WHERE accessibility_features IS NULL")
    cursor.execute("UPDATE jobs SET job_type = 'Full-time' WHERE job_type IS NULL")
    cursor.execute("UPDATE jobs SET location = 'Remote/PH' WHERE location IS NULL")
    cursor.execute("UPDATE jobs SET salary_range = 'Negotiable' WHERE salary_range IS NULL")
    
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
    employer_type: str = "Private"
    salary_range: str = "Negotiable"
    benefits: str = ""
    job_type: str = "Full-time"
    location: str = "Remote/PH"
    accessibility_features: str = ""
    work_environment: str = "Indoor"
    work_tempo: str = "Moderate"

class PWDProfile(BaseModel):
    name: str
    disability_types: List[str] # Now supports multiple entries
    physical_capabilities: str 
    skills: str 
    preferred_intensity: str = "Medium" # Low, Medium, High
    requires_flexibility: bool = False

# ==========================================
# 4. BACKGROUND TASKS
# ==========================================
def generate_job_embedding(job_id: str, job_title: str, employer_name: str, physical_requirements: str, job_description: str, accessibility: str, environment: str, tempo: str):
    try:
        # 1. Vectorization (Bi-Encoder) - Enrich with full context
        rich_context = (
            f"Job: {job_title} at {employer_name}. "
            f"Requirements: {physical_requirements}. "
            f"Accessibility Features: {accessibility}. "
            f"Environment: {environment} with {tempo} tempo. "
            f"Description: {job_description}"
        )
        embedding_tensor = model.encode(rich_context, convert_to_tensor=False)
        embedding_list = embedding_tensor.tolist() 
        
        # 2. AI-Powered Feature Extraction (Flan-T5)
        # This makes the matching engine "smart" by pre-calculating constraints
        prompt = (
            f"Context: {job_description} {physical_requirements}\n"
            "Question: What is the task intensity (Low, Medium, High)? Does it offer schedule flexibility (Yes, No)? List the professional skills.\n"
            "Answer format: Intensity: [type], Flexibility: [Yes/No], Skills: [comma separated list]"
        )
        inputs = tokenizer(prompt, return_tensors="pt").to(device)
        outputs = gen_model.generate(**inputs, max_new_tokens=100)
        extraction_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Parse extraction
        intensity = "Medium"
        flexibility = 0
        skills = ""
        try:
            int_match = re.search(r'Intensity:\s*(\w+)', extraction_text)
            if int_match: intensity = int_match.group(1).strip()
            
            flex_match = re.search(r'Flexibility:\s*(\w+)', extraction_text)
            if flex_match and flex_match.group(1).lower() == 'yes': flexibility = 1
            
            skill_match = re.search(r'Skills:\s*(.*)', extraction_text)
            if skill_match: skills = skill_match.group(1).strip()
        except:
            pass

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE jobs SET status = 'approved', embedding = ?, task_intensity = ?, has_flexibility = ?, structured_skills = ? WHERE id = ?", 
            (json.dumps(embedding_list), intensity, flexibility, skills, job_id)
        )
        conn.commit()
        conn.close()
        print(f"[INFO] Ingestion Complete for {job_id}. Intensity: {intensity}, Skills: {skills}")
    except Exception as e:
        print(f"[ERROR] Background Ingestion Failed for {job_id}: {e}")

# ==========================================
# 5. CORE ENDPOINTS
# ==========================================

@app.post("/api/employer/submit-job")
async def employer_submit_job(job: JobSubmission):
    job_id = str(uuid.uuid4())
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO jobs (id, employer_name, job_title, job_description, physical_requirements, status, employer_type, salary_range, benefits, job_type, location, accessibility_features, work_environment, work_tempo) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)",
        (job_id, job.employer_name, job.job_title, job.job_description, job.physical_requirements, job.employer_type, job.salary_range, job.benefits, job.job_type, job.location, job.accessibility_features, job.work_environment, job.work_tempo)
    )
    conn.commit()
    conn.close()
    return {"message": "Job submitted successfully.", "job_id": job_id}


@app.get("/api/admin/jobs/{status}")
async def get_jobs_by_status(status: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE status = ?", (status,))
    jobs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"count": len(jobs), "jobs": jobs}


@app.post("/api/admin/approve-job/{job_id}")
async def admin_approve_job(job_id: str, background_tasks: BackgroundTasks):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE id = ? AND status = 'pending'", (job_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Pending job not found.")
    background_tasks.add_task(
        generate_job_embedding, 
        job_id, 
        row['job_title'], 
        row['employer_name'], 
        row['physical_requirements'], 
        row['job_description'],
        row['accessibility_features'],
        row['work_environment'],
        row['work_tempo']
    )
    return {"message": "Job verified!"}


@app.delete("/api/admin/delete-job/{job_id}")
async def admin_delete_job(job_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()
    return {"message": "Job deleted successfully."}


@app.post("/api/pwd/match")
async def pwd_suitability_match(profile: PWDProfile):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE status = 'approved' AND embedding IS NOT NULL")
    approved_jobs = [dict(row) for row in cursor.fetchall()]
    conn.close()

    if not approved_jobs:
        return {"message": "No approved jobs available.", "matches": []}

    # --- NO LONGER NEEDED: Extraction helpers replaced by Pre-computed DB columns ---
    def generate_ai_report(scores, user_profile, job_profile, disability_types):
        """
        Multi-Step Analytical Engine: Synthesizes insights for multiple disabilities.
        """
        # Map sub-categories to general expert keys
        knowledge_blocks = []
        for d_type in disability_types:
            category = d_type.split(" - ")[0]
            knowledge_blocks.append(EXPERT_KNOWLEDGE.get(category, EXPERT_KNOWLEDGE["Physical"]))
        
        # Combine contexts and tips
        combined_context = " ".join(list(set([k['context'] for k in knowledge_blocks])))
        combined_tips = " ".join(list(set([k['tip'] for k in knowledge_blocks])))
        
        # Synthesis Prompt
        prompt = (
            f"Expert Context: {combined_context}\n"
            f"As a vocational expert, assess a candidate with the following conditions: {', '.join(disability_types)}.\n"
            f"Job: {job_profile.split('.')[0]}\n"
            f"Requirements: {job_profile}\n"
            f"Identify the unique synergy of challenges or advantages when these conditions coexist in this workplace.\n"
            f"Expert Report:"
        )
        
        try:
            inputs = tokenizer(prompt, return_tensors="pt").to(device)
            outputs = gen_model.generate(
                **inputs, 
                max_new_tokens=250, 
                num_beams=5, 
                repetition_penalty=3.0, 
                early_stopping=True
            )
            ai_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Synthesis of results
            report = [
                f"Multi-Disability Assessment: {ai_text}",
                f"Workplace Modifications: {combined_tips}",
                f"Combined Strengths: {', '.join(list(set([s for k in knowledge_blocks for s in k['strengths']])))[:150]}..."
            ]
            return report
        except Exception as e:
            print(f"[ERROR] Engine v6.0 Failure: {e}")
            return [
                f"Accessibility Assessment: {knowledge['analysis']}",
                f"Work Environment Fit: {knowledge['benefit']}",
                f"Success Strategy: {knowledge['tip']}"
            ]

    # --- 1. PREPARE FAISS INDEX ---
    job_vectors = [json.loads(job['embedding']) for job in approved_jobs]
    job_vectors_np = np.array(job_vectors).astype('float32')
    faiss.normalize_L2(job_vectors_np)
    d = 384 
    index = faiss.IndexFlatIP(d)
    index.add(job_vectors_np)

    # --- 2. VECTORIZE PWD PROFILE ---
    primary_disability = profile.disability_types[0] if profile.disability_types else "Unknown"
    pwd_context = f"Disabilities: {', '.join(profile.disability_types)}. Capabilities: {profile.physical_capabilities}"
    pwd_vector_np = model.encode(pwd_context, convert_to_numpy=True).astype('float32')
    pwd_vector_np = np.expand_dims(pwd_vector_np, axis=0) 
    faiss.normalize_L2(pwd_vector_np)

    # --- 3. FAISS SEARCH EXECUTION (Retrieval) ---
    k = min(len(approved_jobs), 15) # Retrieve top 15 candidates for re-ranking
    distances, indices = index.search(pwd_vector_np, k)

    # --- 3.5 CROSS-ENCODER RE-RANKING (Precision) ---
    print(f"[INFO] Re-ranking {k} candidates with Cross-Encoder...")
    pairs = []
    for i in range(k):
        job = approved_jobs[indices[0][i]]
        # We compare user context vs job requirements specifically
        pairs.append([pwd_context, job['physical_requirements']])
    
    if pairs:
        # Cross-Encoders are more accurate as they see both texts simultaneously
        raw_cross_scores = cross_model.predict(pairs)
        # Convert logits to 0-100 scale using sigmoid
        cross_scores = (1 / (1 + np.exp(-raw_cross_scores))) * 100
    else:
        cross_scores = []

    # --- 4. HYBRID SCORING & FILTERING ---
    # Clean user skills into a set
    pwd_skills_set = set([s.strip().lower() for s in profile.skills.replace(".", "").split(",") if s.strip()])
    matches = []
    # Simple inline extraction for candidate's working capacity
    hour_match = re.search(r'(\d+)\s*hour', profile.physical_capabilities.lower())
    user_hours = int(hour_match.group(1)) if hour_match else 8
    
    for i in range(k):
        job_idx = indices[0][i]
        cos_sim = distances[0][i] 
        job = approved_jobs[job_idx]
        
        # 1. Physical Safety Score (Hybrid Bi-Encoder + Cross-Encoder)
        # Bi-Encoder (cos_sim) provides the broad semantic match
        # Cross-Encoder provides the high-precision re-ranking
        bi_score = float(cos_sim) * 100
        cross_score = float(cross_scores[i])
        
        # Blend: 40% Bi-Encoder, 60% Cross-Encoder
        # This prevents a total failure if the Cross-Encoder is overly pessimistic
        safety_score = (bi_score * 0.40) + (cross_score * 0.60)
        
        # 2. Sustainability Score (20% Weight)
        # Logic: Task Intensity vs User Preference + Burnout Risk
        job_intensity = job.get('task_intensity', 'Medium')
        job_flex = bool(job.get('has_flexibility', 0))
        user_pref = profile.preferred_intensity
        user_needs_flex = profile.requires_flexibility
        
        stamina_score = 100.0
        
        # Intensity Mismatch Penalty
        intensity_map = {"Low": 1, "Medium": 2, "High": 3}
        j_int = intensity_map.get(job_intensity, 2)
        u_pref = intensity_map.get(user_pref, 2)
        
        if j_int > u_pref:
            stamina_score -= (j_int - u_pref) * 25 # Heavy penalty for over-intensity
        
        # Burnout Risk Penalty (High intensity + No flexibility)
        if job_intensity == "High" and not job_flex:
            stamina_score -= 20
            
        # Flexibility Bonus/Requirement
        if user_needs_flex and not job_flex:
            stamina_score -= 30 # User needs it, job doesn't have it
        elif user_needs_flex and job_flex:
            stamina_score = min(100.0, stamina_score + 10)
            
        stamina_score = max(0.0, stamina_score)
        
        # 3. Skill Alignment Score
        job_req_skills = set([s.strip().lower() for s in job['structured_skills'].split(",") if s.strip()])
        if job_req_skills:
            overlap = list(pwd_skills_set.intersection(job_req_skills))
            missing_skills = list(job_req_skills - pwd_skills_set)
            skill_score = (len(overlap) / max(1, len(job_req_skills))) * 100
        else:
            # Fallback: Extract keywords from description
            # Improved regex to catch shorter skills like IT, SQL, PHP (2+ characters)
            job_desc_set = set(re.findall(r'\b\w{2,}\b', job['job_description'].lower()))
            overlap = list(pwd_skills_set.intersection(job_desc_set))
            missing_skills = []
            
            # Use the user's provided skill count as the denominator for a more accurate percentage
            skill_score = (len(overlap) / max(1, len(pwd_skills_set))) * 100
        
        skill_score = min(100.0, skill_score)
        
        # FINAL HYBRID SCORE
        final_accessibility_percentage = (safety_score * 0.40) + (skill_score * 0.40) + (stamina_score * 0.20)
        
        print(f"[DEBUG] Job: {job['job_title']}")
        print(f"        - Safety (Cross-Enc): {safety_score:.1f}% (Weight: 40%)")
        print(f"        - Skill Alignment:    {skill_score:.1f}% (Weight: 40%)")
        print(f"        - Stamina/Flex:       {stamina_score:.1f}% (Weight: 20%)")
        print(f"        - FINAL SCORE:        {final_accessibility_percentage:.1f}%")
        
        # Generate REAL AI Insights
        user_context = f"{', '.join(profile.disability_types)} disabilities. Can work {user_hours if user_hours else 'N/A'} hours. Skills: {profile.skills}"
        job_context = f"{job['job_title']}. Requirements: {job['physical_requirements']}. Description: {job['job_description']}"
        
        current_scores = {
            "safety": round(safety_score, 1),
            "skills": round(skill_score, 1),
            "stamina": round(stamina_score, 1)
        }
        
        # Performance Optimization: Only include jobs that meet the 40% threshold
        if final_accessibility_percentage >= 40.0:
            ai_insights = generate_ai_report(current_scores, user_context, job_context, profile.disability_types)
            
            # --- 5. DYNAMIC STRENGTHS & BARRIERS ---
            # We aggregate strengths/barriers for the first selected disability as primary
            primary_cat = profile.disability_types[0].split(" - ")[0] if profile.disability_types else "Physical"
            knowledge = EXPERT_KNOWLEDGE.get(primary_cat, EXPERT_KNOWLEDGE["Physical"])
            
            # Map scores to specific strengths/barriers
            active_strengths = []
            active_barriers = []
            
            if safety_score >= 60: active_strengths.append(knowledge["strengths"][0])
            else: active_barriers.append(knowledge["barriers"][0])
            
            if skill_score >= 60: active_strengths.append(knowledge["strengths"][2])
            else: active_barriers.append(knowledge["barriers"][1])
            
            if stamina_score >= 80: active_strengths.append(knowledge["strengths"][1])
            else: active_barriers.append(knowledge["barriers"][2])

            matches.append({
                "job_id": job['id'],
                "employer": job['employer_name'],
                "job_title": job['job_title'],
                "physical_requirements": job['physical_requirements'],
                "employer_type": job.get('employer_type', 'Private'),
                "salary_range": job.get('salary_range', 'Negotiable'),
                "benefits": job.get('benefits', ''),
                "job_type": job.get('job_type', 'Full-time'),
                "location": job.get('location', 'Remote/PH'),
                "matched_skills": overlap,
                "missing_skills": missing_skills,
                "metrics": {
                    "safety_score": round(safety_score, 1),
                    "skill_score": round(skill_score, 1),
                    "stamina_score": round(stamina_score, 1),
                    "final_accessibility_percentage": round(final_accessibility_percentage, 1)
                },
                "ai_insights": ai_insights,
                "strengths": active_strengths,
                "barriers": active_barriers
            })
            
    matches.sort(key=lambda x: x["metrics"]["final_accessibility_percentage"], reverse=True)
    response_payload = {"applicant": profile.name, "total_safe_matches": len(matches), "matches": matches}
    print(f"[DEBUG] Full Response: {json.dumps(response_payload)}")
    return response_payload

@app.get("/api/demo/seed")
async def seed_demo_data(background_tasks: BackgroundTasks):
    demo_jobs = [
        {
            "employer_name": "Makati BPO Solutions", 
            "employer_type": "Private",
            "job_title": "Customer Service Representative", 
            "job_type": "Full-time",
            "salary_range": "25,000 - 30,000",
            "location": "Makati City",
            "benefits": "HMO, 13th Month Pay, Paid Leave",
            "job_description": "Handle incoming calls and emails. Required skills: communication, typing, english.", 
            "physical_requirements": "Requires sitting at a desk for 8 hours. Level access only.",
            "accessibility_features": "Ramps/Elevators, Assistive Tech, Ergonomic Stations",
            "work_environment": "Indoor (Office)",
            "work_tempo": "Moderate"
        },
        {
            "employer_name": "NCDA Government Center", 
            "employer_type": "Government",
            "job_title": "Administrative Assistant", 
            "job_type": "Full-time",
            "salary_range": "20,000 - 28,000",
            "location": "Quezon City",
            "benefits": "GSIS, PhilHealth, Leave Credits",
            "job_description": "Process documents and assist in daily operations. Required skills: organization, computer, filing.", 
            "physical_requirements": "Requires light walking. Minimal lifting required.",
            "accessibility_features": "Ramps/Elevators, Braille Signage, Quiet Zones",
            "work_environment": "Indoor (Office)",
            "work_tempo": "Relaxed"
        }
    ]
    conn = get_db_connection()
    cursor = conn.cursor()
    for job in demo_jobs:
        job_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO jobs (id, employer_name, employer_type, job_title, job_type, salary_range, location, benefits, job_description, physical_requirements, accessibility_features, work_environment, work_tempo, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')
        """, (
            job_id, job['employer_name'], job['employer_type'], job['job_title'], job['job_type'], 
            job['salary_range'], job['location'], job['benefits'], job['job_description'], 
            job['physical_requirements'], job['accessibility_features'], job['work_environment'], job['work_tempo']
        ))
        
        background_tasks.add_task(
            generate_job_embedding, 
            job_id, 
            job['job_title'], 
            job['employer_name'], 
            job['physical_requirements'], 
            job['job_description'],
            job['accessibility_features'],
            job['work_environment'],
            job['work_tempo']
        )
    conn.commit()
    conn.close()
    return {"message": "Demo seeded!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)