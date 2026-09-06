from fastapi import FastAPI, BackgroundTasks, HTTPException, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from typing import List, Optional, Any, Dict, Union
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool
from pgvector.psycopg2 import register_vector
import json
import uuid
import sys
import os
import re
import warnings
import logging
import tempfile
import numpy as np

import torch
import hashlib
import secrets
from datetime import datetime, timedelta
from fastapi import Header, Depends
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError

from compatibility_engine import (
    build_capability_profile, score_job_compatibility,
    build_qualification_context, format_education,
)
from suitability_index import compute_suitability_index
from fairness_engine import log_match, compute_admin_fairness_report, prune_match_logs
from ph_schools_data import PH_SCHOOLS
from render_engine import generate_resume

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
app = FastAPI(title="UPLIFT Data Engine", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    init_db()
    seed_admin()
    import socket
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        print(f"\n[INFO] UPLIFT API is running on http://{local_ip}:8000")
    except Exception:
        pass

print("[INFO] Initializing UPLIFT Engine Cluster...")
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
# 1.5 COMPATIBILITY ENGINE
# ==========================================
# The static EXPERT_KNOWLEDGE prose was removed: it assigned the same
# strengths/barriers to everyone in a coarse disability category (stereotype
# by design). Matching now reads functional capabilities via
# compatibility_engine.score_job_compatibility(), which compares the user's
# capability levels against each job's demand levels and returns factual,
# auditable reasons. Disability labels never gate matching.


# ==========================================
# 2. POSTGRESQL DATABASE SETUP
# ==========================================
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "yuichirokanade")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "uplift")
DB_URI = os.getenv("DATABASE_URL", f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

def check_and_create_db():
    """
    Checks if the 'uplift' database exists in PostgreSQL.
    If PostgreSQL is unreachable, raises an informative exception.
    If PostgreSQL is reachable but the 'uplift' database is missing, it connects to 'postgres' and creates it.
    """
    match = re.match(r"postgresql://([^:]+):([^@]+)@([^:/]+):(\d+)/(\w+)", DB_URI)
    if not match:
        return
    user, password, host, port, db_name = match.groups()
    
    try:
        conn = psycopg2.connect(
            dbname=db_name,
            user=user,
            password=password,
            host=host,
            port=port,
            connect_timeout=3
        )
        conn.close()
        return
    except psycopg2.OperationalError as e:
        err_msg = str(e)
        if "database" in err_msg and "does not exist" in err_msg:
            print(f"[INFO] Database '{db_name}' does not exist. Attempting auto-creation...")
            try:
                temp_conn = psycopg2.connect(
                    dbname="postgres",
                    user=user,
                    password=password,
                    host=host,
                    port=port,
                    connect_timeout=3
                )
                temp_conn.autocommit = True
                temp_cursor = temp_conn.cursor()
                temp_cursor.execute(f"CREATE DATABASE {db_name};")
                temp_cursor.close()
                temp_conn.close()
                print(f"[SUCCESS] Database '{db_name}' created successfully!")
            except Exception as create_err:
                print(f"[ERROR] Failed to auto-create database '{db_name}': {create_err}")
                raise create_err
        else:
            instructions = (
                "\n"
                "=======================================================================\n"
                f" [ERROR] PostgreSQL database is unreachable on {host}:{port}.\n"
                " Please ensure that:\n"
                "   1. PostgreSQL is installed and running on your system.\n"
                "      Download it from: https://www.postgresql.org/download/windows/\n"
                "   2. The service is active (run 'pg_ctl' or check Windows Services).\n"
                f"   3. The credentials in .env (user: '{user}') match your PostgreSQL instance.\n"
                "=======================================================================\n"
            )
            print(instructions)
            raise e

class PooledConnectionWrapper:
    """
    Transparent proxy around a psycopg2 pooled connection.
    Calling conn.close() cleanly rolls back any uncommitted transaction
    and returns the physical connection to the pool rather than severing TCP.
    """
    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool
        self._closed = False

    def close(self):
        if not self._closed:
            self._closed = True
            try:
                if not self._conn.closed and self._conn.status == psycopg2.extensions.STATUS_IN_TRANSACTION:
                    self._conn.rollback()
            except Exception:
                pass
            try:
                self._pool.putconn(self._conn)
            except Exception:
                pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def __getattr__(self, name):
        return getattr(self._conn, name)

_db_pool = None

def get_db_pool():
    global _db_pool
    if _db_pool is None or _db_pool.closed:
        _db_pool = ThreadedConnectionPool(
            minconn=2,
            maxconn=20,
            dsn=DB_URI
        )
    return _db_pool

def get_db_connection():
    pool = get_db_pool()
    conn = pool.getconn()
    conn.autocommit = False
    register_vector(conn)
    return PooledConnectionWrapper(conn, pool)

def init_db():
    check_and_create_db()
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    cursor.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            employer_name TEXT,
            job_title TEXT,
            job_description TEXT,
            physical_requirements TEXT,
            status TEXT DEFAULT 'pending',
            embedding vector(384),
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
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            password_hash TEXT,
            name TEXT,
            role TEXT DEFAULT 'user',
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            employer_proof TEXT DEFAULT '',
            summary TEXT DEFAULT '',
            skills TEXT DEFAULT '',
            disabilities TEXT DEFAULT '[]',
            skill_weight REAL DEFAULT 0.5,
            safety_weight REAL DEFAULT 0.5,
            stamina_weight REAL DEFAULT 0.5
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT,
            expires_at TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS applications (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            user_id TEXT NOT NULL,
            job_id TEXT NOT NULL,
            status TEXT DEFAULT 'Pending',
            applied_at TEXT,
            resume_data TEXT,
            employer_notes TEXT DEFAULT '',
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (job_id) REFERENCES jobs (id)
        )
    """)
    new_cols = {
        "employer_id": "TEXT",
        "employer_type": "TEXT DEFAULT 'Private'",
        "salary_range": "TEXT",
        "benefits": "TEXT",
        "job_type": "TEXT DEFAULT 'Full-time'",
        "location": "TEXT",
        "status_reason": "TEXT DEFAULT ''",
        "accessibility_features": "TEXT DEFAULT ''",
        "work_environment": "TEXT DEFAULT 'Indoor'",
        "work_tempo": "TEXT DEFAULT 'Moderate'",
        "cognitive_load": "TEXT DEFAULT 'Medium'",
        "sensory_load": "TEXT DEFAULT 'Low'",
        "social_interaction": "TEXT DEFAULT 'Moderate'",
        "remote_friendly": "INTEGER DEFAULT 0",
        "visual_demand": "TEXT DEFAULT 'Low'",
        "auditory_demand": "TEXT DEFAULT 'Low'",
        "fine_motor_demand": "TEXT DEFAULT 'Medium'",
        "physical_demand": "TEXT DEFAULT 'Medium'"
    }
    for col, definition in new_cols.items():
        cursor.execute(f"ALTER TABLE jobs ADD COLUMN IF NOT EXISTS {col} {definition}")

    # stamina_required was a dual source of truth (stored vs derived from
    # task_intensity). Dropped so matching reads exactly one value.
    cursor.execute("ALTER TABLE jobs DROP COLUMN IF EXISTS stamina_required")

    # Migration for applications
    cursor.execute("ALTER TABLE applications ADD COLUMN IF NOT EXISTS employer_notes TEXT DEFAULT ''")
    
    # Migration for users
    user_cols = {
        "summary": "TEXT DEFAULT ''",
        "skills": "TEXT DEFAULT ''",
        "disabilities": "TEXT DEFAULT '[]'",
        "skill_weight": "REAL DEFAULT 0.5",
        "safety_weight": "REAL DEFAULT 0.5",
        "stamina_weight": "REAL DEFAULT 0.5",
        "physical_capabilities": "TEXT DEFAULT ''",
        "preferred_intensity": "TEXT DEFAULT 'Medium'",
        "requires_flexibility": "INTEGER DEFAULT 0",
        "education": "TEXT DEFAULT ''",
        "experience": "TEXT DEFAULT ''",
        "projects": "TEXT DEFAULT ''",
        "certifications": "TEXT DEFAULT ''",
        "awards": "TEXT DEFAULT ''",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    }
    for col, definition in user_cols.items():
        cursor.execute(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col} {definition}")
    
    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'")
    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS employer_proof TEXT DEFAULT ''")
    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_data TEXT DEFAULT '{}'")
    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS disability_profile TEXT DEFAULT '{}'")
    
    # NCDA AO No. 001 s.2021: PWD ID Reference Number for DOH registry alignment
    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS pwd_id_reference TEXT DEFAULT ''")
    
    # Admin and System Tables
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            admin_id TEXT,
            action TEXT,
            target_type TEXT,
            target_id TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            details TEXT,
            FOREIGN KEY(admin_id) REFERENCES users(id)
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS match_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            disability TEXT NOT NULL DEFAULT 'Unknown',
            score REAL NOT NULL DEFAULT 0,
            safety_score REAL NOT NULL DEFAULT 0,
            skill_score REAL NOT NULL DEFAULT 0,
            stamina_score REAL NOT NULL DEFAULT 0,
            job_id TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    # Add employer approval tracking to users
    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TEXT")
    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by TEXT")
    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT")
    
    # Data Sanity
    cursor.execute("UPDATE jobs SET employer_type = 'Private' WHERE employer_type IS NULL")
    cursor.execute("UPDATE jobs SET work_environment = 'Indoor' WHERE work_environment IS NULL")
    cursor.execute("UPDATE jobs SET work_tempo = 'Moderate' WHERE work_tempo IS NULL")
    cursor.execute("UPDATE jobs SET accessibility_features = '' WHERE accessibility_features IS NULL")
    
    # Add auto_generate_resume column for ATS resume feature
    cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_generate_resume INTEGER DEFAULT 0")
    
    # Seed default resume_theme if not present
    cursor.execute("SELECT value FROM system_settings WHERE key = 'resume_theme'")
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO system_settings (key, value) VALUES ('resume_theme', 'classic')"
        )
    
    # Philippine schools reference table (curated CHED/DepEd subset)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ph_schools (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            level TEXT DEFAULT 'Tertiary',
            city TEXT DEFAULT '',
            region TEXT DEFAULT '',
            UNIQUE(name, level)
        )
    """)
    cursor.execute("SELECT COUNT(*) FROM ph_schools")
    if cursor.fetchone()['count'] == 0:
        for school in PH_SCHOOLS:
            cursor.execute(
                "INSERT INTO ph_schools (name, level, city, region) VALUES (%s, %s, %s, %s) ON CONFLICT (name, level) DO NOTHING",
                school
            )
        print(f"[INFO] Seeded {len(PH_SCHOOLS)} Philippine schools.")


    # match_logs: bounded retention index + startup prune
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_match_logs_created_at ON match_logs(created_at)")
    cursor.execute("DELETE FROM match_logs WHERE created_at < NOW() - INTERVAL '30 days'")
    if cursor.rowcount and cursor.rowcount > 0:
        print(f"[INFO] Pruned {cursor.rowcount} stale match_logs rows.")
    
    # High-Performance Vector & Relational Indexes
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_jobs_embedding_hnsw 
        ON jobs USING hnsw (embedding vector_cosine_ops) 
        WITH (m = 16, ef_construction = 64);
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_employer_id ON jobs(employer_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);")
    
    conn.commit()
    conn.close()


# ==========================================
# 3. AUTHENTICATION & SECURITY
# ==========================================
# JWT Constants
SECRET_KEYS = [
    "uplift_super_secret_key_v1",                    # original key (pre-May 2026)
    "uplift-thesis-secret-key-2026-32bytes-long!!",  # intermediate key
    "uplift-thesis-secret-key-32bytes!!",            # current key
]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

def hash_password(password: str) -> str:
    salt = "uplift_salt_v1" # static salt for prototype
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()

def create_access_token(data: dict):
    to_encode = data.copy()
    if "id" in to_encode and "sub" not in to_encode:
        to_encode["sub"] = to_encode["id"]
        to_encode.pop("id", None)
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEYS[-1], algorithm=ALGORITHM)

async def get_current_user(authorization: str = Header(None)):
    jwt_token = None
    if authorization and authorization.startswith("Bearer "):
        jwt_token = authorization.split(" ")[1]
        
    if not jwt_token:
        raise HTTPException(status_code=401, detail="Missing or invalid token")
        
    # Try each known secret key in case key was rotated
    last_error = None
    for key in SECRET_KEYS:
        try:
            payload = jwt.decode(jwt_token, key, algorithms=[ALGORITHM])
            user_id = payload.get("sub") or payload.get("id")
            if not user_id:
                raise InvalidTokenError("Missing subject (sub) or id in token payload")
            return {
                "id": user_id,
                "email": payload.get("email"),
                "name": payload.get("name"),
                "role": payload.get("role")
            }
        except ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except InvalidTokenError as e:
            last_error = e
            continue  # try next key
    # No key worked
    print(f"[WARN] Token decode failed: {last_error}")
    raise HTTPException(status_code=401, detail=f"Invalid token: {last_error}")

class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: dict = Depends(get_current_user)):
        if user['role'] not in self.allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Operation restricted to roles: {', '.join(self.allowed_roles)}"
            )
        return user

async def check_active_employer(user: dict = Depends(get_current_user)):
    if user['role'] == 'admin':
        return user
    if user['role'] != 'employer':
        raise HTTPException(
            status_code=403,
            detail="Access restricted to employers only."
        )
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT status FROM users WHERE id = %s", (user['id'],))
    row = cursor.fetchone()
    conn.close()
    if not row or row['status'] != 'active':
        raise HTTPException(
            status_code=403,
            detail="Access restricted: Employer account is not active or under review."
        )
    return user

def seed_admin():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Seed Admin
    cursor.execute("SELECT id FROM users WHERE role = 'admin'")
    if not cursor.fetchone():
        admin_id = str(uuid.uuid4())
        pw_hash = hash_password("admin123")
        cursor.execute(
            "INSERT INTO users (id, email, password_hash, name, role, status) VALUES (%s, %s, %s, %s, %s, %s)",
            (admin_id, 'admin@uplift.com', pw_hash, 'System Admin', 'admin', 'active')
        )
        print(f"[INFO] Default admin seeded: admin@uplift.com / admin123")
        
    # 2. Seed Employer
    cursor.execute("SELECT id FROM users WHERE email = 'employer@uplift.com'")
    employer_row = cursor.fetchone()
    if not employer_row:
        employer_id = str(uuid.uuid4())
        pw_hash = hash_password("employer123")
        cursor.execute(
            "INSERT INTO users (id, email, password_hash, name, role, status, verification_data) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (employer_id, 'employer@uplift.com', pw_hash, 'Makati BPO Solutions', 'employer', 'active', '{}')
        )
        print(f"[INFO] Default employer seeded: employer@uplift.com / employer123")
    else:
        employer_id = employer_row['id']
        
    # 3. Associate all jobs that don't have an employer_id with this employer
    cursor.execute("UPDATE jobs SET employer_id = %s WHERE employer_id IS NULL OR employer_id = ''", (employer_id,))
    
    conn.commit()
    conn.close()

# ==========================================
# 3. PYDANTIC DATA MODELS
# ==========================================
class JobSubmission(BaseModel):
    employer_name: str = ""
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
    structured_skills: str = ""
    # New AI Matching Fields
    cognitive_load: str = "Medium"
    sensory_load: str = "Low"
    social_interaction: str = "Moderate"
    has_flexibility: bool = False
    remote_friendly: bool = False
    visual_demand: str = "Low"
    auditory_demand: str = "Low"
    fine_motor_demand: str = "Medium"
    physical_demand: str = "Medium"

class JobAnalysisRequest(BaseModel):
    job_title: str = ""
    job_description: str = ""
    work_environment: str = "Indoor"

class VerifyEmployerRequest(BaseModel):
    user_id: str
    action: str # 'approve' or 'reject'
    reason: str = ""

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "user"
    disability_profile: str = "{}"
    education: str = ""
    skills: str = ""

class LoginRequest(BaseModel):
    email: str
    password: str

class SearchRequest(BaseModel):
    search_query: str = ""
    use_profile_context: bool = True

class ProfileUpdate(BaseModel):
    summary: Optional[str] = ""
    skills: Optional[str] = ""
    disabilities: Optional[List[Any]] = []
    disability_profile: Optional[Any] = "{}"
    physical_capabilities: Optional[str] = ""
    preferred_intensity: Optional[str] = "Medium"
    requires_flexibility: Optional[bool] = False
    skill_weight: Optional[float] = 0.5
    safety_weight: Optional[float] = 0.5
    stamina_weight: Optional[float] = 0.5
    education: Optional[Any] = ""
    experience: Optional[Any] = ""
    projects: Optional[Any] = ""
    certifications: Optional[Any] = ""
    awards: Optional[Any] = ""
    auto_generate_resume: Optional[bool] = False

class ResumeGenerateRequest(BaseModel):
    theme: str = ""

class PWDProfile(BaseModel):
    id: str
    email: str
    name: str
    role: str
    status: str
    summary: str
    skills: str
    disabilities: List[str]
    physical_capabilities: str
    preferred_intensity: str
    requires_flexibility: bool
    skill_weight: float
    safety_weight: float
    stamina_weight: float
    education: str
    experience: str
    projects: str
    certifications: str
    awards: str

class ApplicationAction(BaseModel):
    status: str # 'shortlisted' or 'rejected'
    notes: str = ""

class EmployerVerificationSubmission(BaseModel):
    company_name: str
    company_type: str
    location: str
    industry: str
    contact_person: str
    proof_filename: str = "registration_permit.pdf"

# Endpoints for Admin Management
@app.get("/api/admin/employers/{status}")
async def get_employers_by_status(status: str, user: dict = Depends(RoleChecker(['admin']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT id, email, name, status, employer_proof, verification_data, created_at FROM users WHERE role = 'employer' AND status = %s", (status,))
    employers = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return {"count": len(employers), "employers": employers}

@app.post("/api/admin/verify-employer/{user_id}")
async def verify_employer(user_id: str, req: VerifyEmployerRequest, user: dict = Depends(RoleChecker(['admin']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    new_status = 'active' if req.action == 'approve' else 'rejected'
    cursor.execute(
        "UPDATE users SET status = %s, approved_at = %s, approved_by = %s, rejection_reason = %s WHERE id = %s",
        (new_status, datetime.now().isoformat() if req.action == 'approve' else None, user['id'], req.reason, user_id)
    )
    
    # Audit log
    audit_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, details) VALUES (%s, %s, %s, 'employer', %s, %s)",
        (audit_id, user['id'], req.action, user_id, f"{req.action.capitalize()}ed employer. Reason: {req.reason}")
    )
    conn.commit()
    conn.close()
    return {"message": f"Employer {req.action}ed successfully."}

@app.get("/api/admin/system-info")
async def get_system_info(user: dict = Depends(RoleChecker(['admin']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    stats = {
        "pwd_count": 0,
        "employer_count": 0,
        "pending_employers": 0,
        "pending_jobs": 0,
        "active_jobs": 0,
        "total_applications": 0,
        "system_status": "Healthy",
        "ai_engine": "Online"
    }
    
    cursor.execute("SELECT COUNT(*) AS count FROM users WHERE role = 'user'")
    stats['pwd_count'] = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) AS count FROM users WHERE role = 'employer' AND status = 'active'")
    stats['employer_count'] = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) AS count FROM users WHERE role = 'employer' AND status = 'pending'")
    stats['pending_employers'] = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) AS count FROM jobs WHERE status = 'pending'")
    stats['pending_jobs'] = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) AS count FROM jobs WHERE status = 'approved'")
    stats['active_jobs'] = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) AS count FROM applications")
    stats['total_applications'] = cursor.fetchone()['count']
    
    conn.close()
    return stats

@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(user_id: str, user: dict = Depends(RoleChecker(['admin']))):
    if user_id == user['id']:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
        
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Check if user exists
    cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
    target = cursor.fetchone()
    if not target:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
        
    cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
    
    # Log deletion
    log_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, details) VALUES (%s, %s, %s, %s, %s, %s)",
        (log_id, user['id'], "delete_user", "user", user_id, f"Role was: {target['role']}")
    )
    
    conn.commit()
    conn.close()
    return {"message": "User deleted successfully."}

@app.get("/api/admin/logs")
async def get_admin_logs(user: dict = Depends(RoleChecker(['admin']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT a.*, u.name as admin_name 
        FROM audit_logs a 
        JOIN users u ON a.admin_id = u.id 
        ORDER BY a.timestamp DESC
    """)
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs

@app.get("/api/admin/fairness-report")
async def get_fairness_report(user: dict = Depends(RoleChecker(['admin']))):
    """AIF360 fairness audit across all disability groups in match_logs.
    
    Tracks demographic parity, disparate impact, and group-level score
    distributions across the 11 NCDA AO No. 001 s.2021 disability types.
    Data is populated by log_match() calls in the suitability-match pipeline.
    """
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        report = compute_admin_fairness_report(cursor=cursor)
        return report
    finally:
        conn.close()

@app.post("/api/employer/verify")
async def employer_submit_verification(req: EmployerVerificationSubmission, user: dict = Depends(RoleChecker(['employer']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Store the JSON verification data
    verification_json = json.dumps({
        "company_name": req.company_name,
        "company_type": req.company_type,
        "industry": req.industry,
        "contact_person": req.contact_person,
        "submitted_at": datetime.now().isoformat()
    })
    
    cursor.execute(
        "UPDATE users SET name = %s, status = 'pending', employer_proof = %s, verification_data = %s, rejection_reason = NULL WHERE id = %s",
        (req.company_name, req.proof_filename, verification_json, user['id'])
    )
    
    conn.commit()
    conn.close()
    return {"message": "Verification documents submitted successfully."}

# ==========================================
# 4. BACKGROUND TASKS & SEMANTIC ENVELOPE
# ==========================================
def build_job_semantic_envelope(job: dict) -> str:
    """
    Constructs a rich, unambiguous semantic envelope for Bi-Encoder embedding (all-MiniLM-L12-v2)
    and pgvector HNSW index retrieval. Encodes vocational skills, workstation posture, communication style,
    and environmental parameters into high-dimensional dense vector space.
    """
    title = job.get('job_title') or 'Job'
    employer = job.get('employer_name') or 'Employer'
    job_type = job.get('job_type') or 'Full-time'
    location = job.get('location') or 'Philippines'
    desc = job.get('job_description') or ''
    skills = job.get('structured_skills') or ''
    phys_req = job.get('physical_requirements') or 'Standard office physical requirements.'
    env = job.get('work_environment') or 'Indoor'
    tempo = job.get('work_tempo') or 'Moderate'
    intensity = job.get('task_intensity') or 'Medium'
    access = job.get('accessibility_features') or ''
    remote = "Remote-friendly" if job.get('remote_friendly') else "On-site/Office"
    
    parts = [
        f"Role: {title} at {employer} ({job_type}, {location}, {remote}).",
        f"Responsibilities & Duties: {desc}.",
    ]
    if skills:
        parts.append(f"Required Skills & Competencies: {skills}.")
    if phys_req:
        parts.append(f"Physical Posture & Workstation Requirements: {phys_req}.")
    parts.append(f"Work Environment & Pace: Setting={env}, Tempo={tempo}, Task Intensity={intensity}.")
    if access:
        parts.append(f"Workplace Inclusivity & Accessibility Features: {access}.")
        
    return " ".join(parts)


def generate_job_embedding(job_id: str, job_title: str, employer_name: str, physical_requirements: str, job_description: str, accessibility: str, environment: str, tempo: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM jobs WHERE id = %s", (job_id,))
        job_row = cursor.fetchone()
        
        current_job = dict(job_row) if job_row else {
            "id": job_id, "job_title": job_title, "employer_name": employer_name, 
            "physical_requirements": physical_requirements, "job_description": job_description, 
            "accessibility_features": accessibility, "work_environment": environment, 
            "work_tempo": tempo
        }
        
        # 1. AI-Powered Feature Extraction (Flan-T5) if skills or intensity are missing
        skills = current_job.get("structured_skills") or ""
        intensity = current_job.get("task_intensity") or "Medium"
        flexibility = current_job.get("has_flexibility", 0)
        
        if not skills or skills.strip() == "":
            try:
                prompt = (
                    f"Context: {job_description} {physical_requirements}\n"
                    "Question: What is the task intensity (Low, Medium, High)? Does it offer schedule flexibility (Yes, No)? List the professional skills.\n"
                    "Answer format: Intensity: [type], Flexibility: [Yes/No], Skills: [comma separated list]"
                )
                inputs = tokenizer(prompt, return_tensors="pt").to(device)
                outputs = gen_model.generate(**inputs, max_new_tokens=100)
                extraction_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
                
                int_match = re.search(r'Intensity:\s*(\w+)', extraction_text)
                if int_match: intensity = int_match.group(1).strip()
                
                flex_match = re.search(r'Flexibility:\s*(\w+)', extraction_text)
                if flex_match and flex_match.group(1).lower() == 'yes': flexibility = 1
                
                skill_match = re.search(r'Skills:\s*(.*)', extraction_text)
                if skill_match and not skills: skills = skill_match.group(1).strip()
            except Exception as parse_err:
                print(f"[WARN] Flan-T5 extraction notice for job {job_id}: {parse_err}")
                
        current_job["structured_skills"] = skills
        current_job["task_intensity"] = intensity
        current_job["has_flexibility"] = flexibility

        # 2. Build Rich Semantic Envelope and Vectorize
        rich_context = build_job_semantic_envelope(current_job)
        embedding_tensor = model.encode(rich_context, convert_to_tensor=False)
        embedding_list = embedding_tensor.tolist() 

        cursor.execute(
            """UPDATE jobs SET status = 'approved', embedding = %s, task_intensity = %s, 
               has_flexibility = %s, structured_skills = %s WHERE id = %s""",
            (json.dumps(embedding_list), intensity, flexibility, skills, job_id)
        )
        conn.commit()
        conn.close()
        print(f"[INFO] Ingestion & Semantic Indexing Complete for {job_id}. Intensity: {intensity}, Skills: {skills}")
    except Exception as e:
        print(f"[ERROR] Background Ingestion Failed for {job_id}: {e}")

# ==========================================
# 5. CORE ENDPOINTS
# ==========================================

@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT id FROM users WHERE email = %s", (req.email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Core-first registration: disability type, educational history and
    # technical skills are mandatory so the matcher always has a fair,
    # complete baseline (no fabricated or missing profile context).
    try:
        disability_profile = json.loads(req.disability_profile) if req.disability_profile else {}
    except (json.JSONDecodeError, TypeError):
        disability_profile = {}
    disability_labels = []
    for entry in disability_profile.get("disabilities") or []:
        if isinstance(entry, dict):
            label = entry.get("category", "")
            if entry.get("subtype"):
                label += f": {entry['subtype']}"
                if entry.get("extent"):
                    label += f" ({entry['extent']})"
            if label:
                disability_labels.append(label)
        elif isinstance(entry, str) and entry.strip():
            disability_labels.append(entry.strip())
    if not disability_labels:
        conn.close()
        raise HTTPException(status_code=400, detail="Disability type is required. Select at least one disability.")
    if not (req.education or "").strip():
        conn.close()
        raise HTTPException(status_code=400, detail="Educational history is required.")
    if not (req.skills or "").strip():
        conn.close()
        raise HTTPException(status_code=400, detail="Technical skills are required.")

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(req.password)
    
    cursor.execute(
        """INSERT INTO users (id, email, password_hash, name, role, status,
                             disability_profile, disabilities, education, skills)
           VALUES (%s, %s, %s, %s, %s, 'active', %s, %s, %s, %s)""",
        (user_id, req.email, pw_hash, req.name, req.role,
         json.dumps(disability_profile), json.dumps(disability_labels),
         req.education, req.skills)
    )
    conn.commit()
    conn.close()
    return {"message": "Registration successful"}

@app.post("/api/auth/register/employer")
async def register_employer(req: RegisterRequest):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT id FROM users WHERE email = %s", (req.email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    pw_hash = hash_password(req.password)
    
    cursor.execute(
        "INSERT INTO users (id, email, password_hash, name, role, status) VALUES (%s, %s, %s, %s, %s, %s)",
        (user_id, req.email, pw_hash, req.name, 'employer', 'pending')
    )
    conn.commit()
    conn.close()
    return {"message": "Application submitted. Awaiting admin approval."}

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT id, email, name, role, status, verification_data, rejection_reason, 
               summary, skills, disabilities, disability_profile,
               skill_weight, safety_weight, stamina_weight, 
               physical_capabilities, preferred_intensity, requires_flexibility,
               education, experience, projects, certifications, awards,
               auto_generate_resume, password_hash 
        FROM users WHERE email = %s
    """, (req.email,))
    user = cursor.fetchone()
    
    if not user or user['password_hash'] != hash_password(req.password):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    token = create_access_token({
        "sub": user['id'],
        "email": user['email'],
        "name": user['name'],
        "role": user['role']
    })
    
    full_user = dict(user)
    full_user.pop('password_hash', None)
    
    # Safely parse JSON fields so frontend receives ready-to-use objects/arrays
    try:
        full_user['disabilities'] = json.loads(full_user['disabilities']) if full_user.get('disabilities') else []
    except Exception:
        full_user['disabilities'] = []
        
    try:
        full_user['disability_profile'] = json.loads(full_user['disability_profile']) if full_user.get('disability_profile') else {}
    except Exception:
        full_user['disability_profile'] = {}
        
    try:
        if isinstance(full_user.get('verification_data'), str):
            full_user['verification_data'] = json.loads(full_user['verification_data']) if full_user['verification_data'] else {}
        elif full_user.get('verification_data') is None:
            full_user['verification_data'] = {}
    except Exception:
        full_user['verification_data'] = {}

    conn.close()
    return {
        "token": token, 
        "user": full_user
    }

@app.post("/api/auth/logout")
async def logout():
    return {"message": "Logged out"}

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@app.post("/api/auth/change-password")
async def change_password(req: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT password_hash FROM users WHERE id = %s", (user['id'],))
    row = cursor.fetchone()
    if not row or row['password_hash'] != hash_password(req.old_password):
        conn.close()
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    new_hash = hash_password(req.new_password)
    cursor.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, user['id']))
    conn.commit()
    conn.close()
    return {"message": "Password changed successfully"}

@app.delete("/api/auth/delete-account")
async def delete_account(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("DELETE FROM users WHERE id = %s", (user['id'],))
    conn.commit()
    conn.close()
    return {"message": "Account deleted successfully"}

@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    """
    Return user profile from the DB when available.
    Falls back to JWT payload data if the DB is down or user was re-seeded.
    Also returns a fresh JWT token so the frontend can populate localStorage
    for Authorization header usage.
    """
    fresh_token = create_access_token(user)
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        role = user.get('role', 'user')
        row = None
        
        if role in ('admin', 'employer'):
            cursor.execute(
                "SELECT id, email, name, role, status, verification_data, rejection_reason, summary FROM users WHERE id = %s",
                (user['id'],)
            )
            row = cursor.fetchone()
        else:
            cursor.execute("""
                SELECT id, email, name, role, summary, skills, disabilities, 
                       disability_profile,
                       skill_weight, safety_weight, stamina_weight, 
                       physical_capabilities, preferred_intensity, requires_flexibility,
                       education, experience, projects, certifications, awards,
                       auto_generate_resume
                FROM users WHERE id = %s
            """, (user['id'],))
            row = cursor.fetchone()
        
        conn.close()
        
        if row:
            full_user = dict(row)
            if role not in ('admin', 'employer'):
                try:
                    full_user['disabilities'] = json.loads(full_user['disabilities']) if full_user['disabilities'] else []
                except:
                    full_user['disabilities'] = []
                try:
                    full_user['disability_profile'] = json.loads(full_user['disability_profile']) if full_user['disability_profile'] else {}
                except:
                    full_user['disability_profile'] = {}
            else:
                full_user['disabilities'] = []
                try:
                    if isinstance(full_user.get('verification_data'), str):
                        full_user['verification_data'] = json.loads(full_user['verification_data']) if full_user['verification_data'] else {}
                    elif full_user.get('verification_data') is None:
                        full_user['verification_data'] = {}
                except:
                    full_user['verification_data'] = {}
            return {**full_user, "token": fresh_token}
    except Exception as e:
        print(f"[WARN] /api/auth/me DB query failed: {e}")
    
    # Fallback
    return {
        "id": user.get('id'),
        "email": user.get('email'),
        "name": user.get('name'),
        "role": user.get('role'),
        "summary": "",
        "skills": "",
        "disabilities": [],
        "disability_profile": {},
        "skill_weight": 0.5,
        "safety_weight": 0.5,
        "stamina_weight": 0.5,
        "physical_capabilities": "",
        "preferred_intensity": "Medium",
        "requires_flexibility": False,
        "education": "",
        "experience": "",
        "projects": "",
        "certifications": "",
        "awards": "",
        "auto_generate_resume": False,
        "token": fresh_token
    }

@app.post("/api/employer/ai-analyze-description")
async def ai_analyze_job_description(req: JobAnalysisRequest, user: dict = Depends(RoleChecker(['employer', 'admin']))):
    """
    Provides real-time AI clarity analysis, actionable improvement tips, and extracted tags.
    """
    desc = req.job_description.strip()
    title = req.job_title.strip()
    if not desc:
        return {
            "clarity_score": 20,
            "clarity_label": "Needs more detail",
            "signals": {
                "skills": False,
                "posture": False,
                "communication": False,
                "environment": False
            },
            "tips": [
                "Describe key daily duties and specific tools or software required.",
                "Specify whether work is seated at a desk or involves physical moving/lifting.",
                "Mention primary communication modes (e.g. text-first chat vs. spoken calls)."
            ],
            "skills": [],
            "suggested_posture": "Mostly Seated",
            "suggested_communication": "Mixed",
            "suggested_pace": "Standard",
            "suggested_snippet": ""
        }
        
    try:
        desc_lower = desc.lower()
        title_lower = title.lower()
        combined_text = f"{title_lower} {desc_lower}"
        
        # 1. NLP Pattern & Pillar Detection
        has_posture = bool(re.search(r'\b(seated|sitting|stand|standing|lift|lifting|desk|posture|ergonomic|physical|carrying|walking|mobile)\b', combined_text))
        has_comm = bool(re.search(r'\b(slack|email|chat|text|written|phone|call|calls|verbal|spoken|meeting|meetings|ticket|tickets)\b', combined_text))
        has_setting = bool(re.search(r'\b(remote|home|office|indoor|hybrid|onsite|on-site|flexible|shift|schedule|environment)\b', combined_text))
        
        # 2. Flan-T5 Feature & Skill Extraction
        prompt = (
            f"Context: Job title: {title}. Description: {desc}.\n"
            "Question: 1. Extract 3 to 6 key professional skills. 2. What is the physical posture (Mostly Seated, Mixed Standing, Physical Handling)? 3. What is the communication mode (Text-First, Phone/Spoken, Mixed)? 4. What is the work pace (Self-Paced, Standard, Fast-Paced)?\n"
            "Answer format: Skills: [comma separated skills] | Posture: [posture] | Communication: [mode] | Pace: [pace]"
        )
        inputs = tokenizer(prompt, return_tensors="pt").to(device)
        outputs = gen_model.generate(**inputs, max_new_tokens=120)
        res_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        skills_match = re.search(r'Skills:\s*([^|]+)', res_text)
        posture_match = re.search(r'Posture:\s*([^|]+)', res_text)
        comm_match = re.search(r'Communication:\s*([^|]+)', res_text)
        pace_match = re.search(r'Pace:\s*([^|]+)', res_text)
        
        extracted_skills = [s.strip() for s in skills_match.group(1).split(",") if s.strip()] if skills_match else []
        extracted_posture = posture_match.group(1).strip() if posture_match else "Mostly Seated"
        extracted_comm = comm_match.group(1).strip() if comm_match else "Mixed"
        extracted_pace = pace_match.group(1).strip() if pace_match else "Standard"
        
        has_skills = len(extracted_skills) >= 2 or len(desc.split()) > 40
        
        # 3. Transparent Clarity Score Breakdown (Pillar-based)
        score = 20 # Baseline
        if has_skills: score += 20
        if has_posture: score += 20
        if has_comm: score += 20
        if has_setting: score += 20
        
        clarity_score = min(100, max(20, score))
        
        # 4. Actionable Improvement Tips (How to increase score)
        tips = []
        snippets = []
        if not has_posture:
            tips.append("Add workstation posture (e.g., '100% seated computer work, lifting under 5 lbs') to boost physical safety matching (+20%).")
            snippets.append("Physical Requirements: 100% seated computer workstation. No heavy lifting or stair climbing required.")
        if not has_comm:
            tips.append("Specify communication channels (e.g., 'Text-first workflow via Slack/Email, minimal voice calls') to help deaf/hard-of-hearing candidates (+20%).")
            snippets.append("Communication: Text-first communication via Slack and Email with optional captioned video calls.")
        if not has_skills:
            tips.append("List 3+ concrete vocational tools or skills (e.g., 'Google Sheets, Data Entry, Customer Support') (+20%).")
        if not has_setting:
            tips.append("Clarify work setting & schedule (e.g., 'Remote from home with flexible breaks') (+20%).")
            snippets.append("Work Environment: Remote-friendly setup with flexible schedule and rest intervals.")
            
        suggested_snippet = " ".join(snippets)
        
        return {
            "clarity_score": clarity_score,
            "clarity_label": "🌟 High Match Precision (90%+)" if clarity_score >= 85 else "✓ Good Match Clarity (70-84%)" if clarity_score >= 65 else "⚡ Moderate Detail (Needs Polish)",
            "signals": {
                "skills": has_skills,
                "posture": has_posture,
                "communication": has_comm,
                "environment": has_setting
            },
            "tips": tips,
            "suggested_snippet": suggested_snippet,
            "skills": extracted_skills,
            "suggested_posture": extracted_posture,
            "suggested_communication": extracted_comm,
            "suggested_pace": extracted_pace
        }
    except Exception as e:
        return {
            "clarity_score": 75,
            "clarity_label": "✓ Good Match Clarity",
            "signals": {
                "skills": True,
                "posture": True,
                "communication": False,
                "environment": True
            },
            "tips": ["Clarify communication mode (text-first vs phone calls) to maximize match accuracy."],
            "suggested_snippet": "Physical Requirements: 100% seated computer workstation. Communication: Text-first via Slack/Email.",
            "skills": [],
            "suggested_posture": "Mostly Seated",
            "suggested_communication": "Mixed",
            "suggested_pace": "Standard"
        }

@app.post("/api/employer/submit-job")
async def employer_submit_job(job: JobSubmission, user: dict = Depends(RoleChecker(['employer', 'admin']))):
    job_id = str(uuid.uuid4())
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        "INSERT INTO jobs (id, employer_id, employer_name, job_title, job_description, physical_requirements, status, employer_type, salary_range, benefits, job_type, location, accessibility_features, work_environment, work_tempo, structured_skills, cognitive_load, sensory_load, social_interaction, has_flexibility, remote_friendly, visual_demand, auditory_demand, fine_motor_demand, physical_demand) VALUES (%s, %s, %s, %s, %s, %s, 'pending', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
        (job_id, user['id'], job.employer_name or user['name'], job.job_title, job.job_description, job.physical_requirements, job.employer_type, job.salary_range, job.benefits, job.job_type, job.location, job.accessibility_features, job.work_environment, job.work_tempo, job.structured_skills, job.cognitive_load, job.sensory_load, job.social_interaction, 1 if job.has_flexibility else 0, 1 if job.remote_friendly else 0, job.visual_demand, job.auditory_demand, job.fine_motor_demand, job.physical_demand)
    )
    conn.commit()
    conn.close()
    return {"message": "Job submitted successfully.", "job_id": job_id}


@app.get("/api/admin/jobs/{status}")
async def get_jobs_by_status(status: str, user: dict = Depends(RoleChecker(['admin']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM jobs WHERE status = %s", (status,))
    jobs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    for j in jobs:
        j.pop('embedding', None)
    return {"count": len(jobs), "jobs": jobs}


@app.post("/api/admin/approve-job/{job_id}")
async def admin_approve_job(job_id: str, background_tasks: BackgroundTasks, user: dict = Depends(RoleChecker(['admin']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM jobs WHERE id = %s AND status = 'pending'", (job_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Pending job not found.")
    
    cursor.execute("UPDATE jobs SET status = 'approved' WHERE id = %s", (job_id,))
    
    # Audit log
    audit_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, details) VALUES (%s, %s, 'approve', 'job', %s, %s)",
        (audit_id, user['id'], job_id, f"Approved job: {row['job_title']}")
    )
    
    conn.commit()
    conn.close()

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
    return {"message": "Job verified and indexed!"}

    return logs


@app.put("/api/pwd/profile")
async def update_pwd_profile(req: ProfileUpdate, user: dict = Depends(RoleChecker(['user']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    dp_str = json.dumps(req.disability_profile) if isinstance(req.disability_profile, (dict, list)) else str(req.disability_profile or "{}")
    dis_str = json.dumps(req.disabilities) if isinstance(req.disabilities, list) else str(req.disabilities or "[]")
    edu_str = json.dumps(req.education) if isinstance(req.education, (list, dict)) else str(req.education or "")
    exp_str = json.dumps(req.experience) if isinstance(req.experience, (list, dict)) else str(req.experience or "")
    proj_str = json.dumps(req.projects) if isinstance(req.projects, (list, dict)) else str(req.projects or "")
    cert_str = json.dumps(req.certifications) if isinstance(req.certifications, (list, dict)) else str(req.certifications or "")
    awd_str = json.dumps(req.awards) if isinstance(req.awards, (list, dict)) else str(req.awards or "")

    cursor.execute("""
        UPDATE users 
        SET summary = %s, skills = %s, disabilities = %s, 
            disability_profile = %s,
            skill_weight = %s, safety_weight = %s, stamina_weight = %s,
            physical_capabilities = %s, preferred_intensity = %s, requires_flexibility = %s,
            education = %s, experience = %s, projects = %s, certifications = %s, awards = %s,
            auto_generate_resume = %s
        WHERE id = %s
    """, (
        req.summary or "", req.skills or "", dis_str,
        dp_str,
        req.skill_weight if req.skill_weight is not None else 0.5,
        req.safety_weight if req.safety_weight is not None else 0.5,
        req.stamina_weight if req.stamina_weight is not None else 0.5,
        req.physical_capabilities or "", req.preferred_intensity or "Medium", 1 if req.requires_flexibility else 0,
        edu_str, exp_str, proj_str, cert_str, awd_str,
        1 if req.auto_generate_resume else 0,
        user['id']
    ))
    conn.commit()
    
    # Return updated user
    cursor.execute("""
        SELECT id, email, name, role, summary, skills, disabilities, 
               disability_profile,
               skill_weight, safety_weight, stamina_weight, 
               physical_capabilities, preferred_intensity, requires_flexibility,
               education, experience, projects, certifications, awards,
               auto_generate_resume
        FROM users WHERE id = %s
    """, (user['id'],))
    row = cursor.fetchone()
    conn.close()
    
    updated_user = dict(row)
    try:
        updated_user['disabilities'] = json.loads(updated_user['disabilities']) if updated_user.get('disabilities') else []
    except:
        updated_user['disabilities'] = []
    try:
        updated_user['disability_profile'] = json.loads(updated_user['disability_profile']) if updated_user.get('disability_profile') else {}
    except:
        updated_user['disability_profile'] = {}
        
    return {"message": "Profile updated successfully.", "user": updated_user}

def generate_ai_report(metrics, user_ctx, job_ctx, facts, ontology_reasons=None):
    """Generates a high-stability analytical report using Context-Question-Answer (CQA) prompting.
    `facts` are factual, capability-derived strings (no static category stereotypes)."""
    try:
        job_title = job_ctx.split(" at ")[0] if " at " in job_ctx else job_ctx
        
        # Unpack metrics for explainability grounding
        safety = metrics.get("safety", 100.0)
        skills = metrics.get("skills", 100.0)
        stamina = metrics.get("stamina", 100.0)
        ontology = metrics.get("ontology", 100.0)
        
        score_context = (
            f"Matching metrics: safety alignment = {safety:.1f}%, "
            f"technical skill relevance = {skills:.1f}%, "
            f"sustainability and stamina = {stamina:.1f}%, "
            f"workplace suitability compatibility score = {ontology:.1f}%."
        )

        def run_stable_model(question, context, max_new=250):
            # CQA Prompting: Ground the model with specific metrics context to ensure explainability
            prompt = (
                f"Context: You are an expert vocational analyst. {score_context} {context} The user is a {user_ctx} and the job is {job_title}.\n"
                f"Question: {question}\n"
                f"Answer:"
            )
            inputs = tokenizer(prompt, return_tensors="pt").to(device)
            outputs = gen_model.generate(
                **inputs, 
                max_new_tokens=max_new, 
                temperature=0.1,
                do_sample=False,
                repetition_penalty=1.2,
                no_repeat_ngram_size=3,
                early_stopping=True
            )
            res = tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
            return res.replace("Answer:", "").replace("Answer", "").strip()

        # 1. Compatibility (grounded in suitability summary and safety score)
        compatibility_raw = run_stable_model(
            f"Based on the safety score of {safety:.1f}%, provide a concise summary explaining why this role is an accessible and safe match for the user.",
            facts.get("analysis", "Workplace suitability overview.")
        )
        compatibility_clean = compatibility_raw.strip()
        if len(compatibility_clean) > 40 and "Person with" not in compatibility_clean:
            compatibility_final = compatibility_clean
        else:
            compatibility_final = facts.get("analysis", f"Based on a safety score of {safety:.1f}% and workplace suitability of {ontology:.1f}%, the {job_title} role aligns safely with the candidate's accessibility profile.")
        
        # 2. Performance (grounded in skill score and pros summary)
        performance_raw = run_stable_model(
            f"Considering the technical skill relevance score of {skills:.1f}%, describe the user's expected workplace performance.",
            facts.get("performance", "Productivity and capability alignment.")
        )
        performance_clean = performance_raw.strip()
        if len(performance_clean) > 40 and "Person with" not in performance_clean:
            performance_final = performance_clean
        else:
            performance_final = facts.get("performance", f"With a technical skill relevance score of {skills:.1f}%, the candidate possesses strong foundation to carry out core duties effectively.")
        
        # 3. Advice (grounded in ontology compatibility and accommodations)
        advice_raw = run_stable_model(
            f"Given the workplace suitability score of {ontology:.1f}%, what ergonomic or workflow recommendations will optimize success?",
            facts.get("advice", "Workplace accommodation guidance.")
        )
        advice_clean = advice_raw.strip()
        if len(advice_clean) > 40 and "Person with" not in advice_clean:
            advice_final = advice_clean
        else:
            advice_final = facts.get("advice", "Standard ergonomic review and adjustable workstation arrangements are recommended.")
        
        # 4. Challenges (Cons - grounded in stamina and potential barriers)
        challenges_raw = run_stable_model(
            f"Referencing the stamina score of {stamina:.1f}%, summarize any operational considerations to prevent fatigue.",
            facts.get("hinder", "No significant barriers detected.")
        )
        challenges_clean = challenges_raw.strip()
        if len(challenges_clean) > 40 and "Person with" not in challenges_clean:
            challenges_final = challenges_clean
        else:
            challenges_final = facts.get("hinder", f"Maintaining regular rest intervals and predictable task distribution will support sustained comfort.")

        return {
            "compatibility": compatibility_final,
            "performance": performance_final,
            "advice": advice_final,
            "challenges": challenges_final,
            "barriers": facts.get("barriers", [])
        }
    except Exception as e:
        print(f"[ERROR] CQA Generation failed: {e}")
        return {
            "compatibility": facts.get("analysis", "Workplace suitability overview."),
            "performance": facts.get("performance", "Productivity and capability alignment."),
            "advice": facts.get("advice", "Standard ergonomic review recommended."),
            "challenges": facts.get("hinder", "No significant barriers detected."),
            "barriers": facts.get("barriers", [])
        }

@app.delete("/api/admin/delete-job/{job_id}")
async def admin_delete_job(job_id: str, user: dict = Depends(RoleChecker(['admin']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("DELETE FROM jobs WHERE id = %s", (job_id,))
    conn.commit()
    conn.close()
    return {"message": "Job deleted successfully."}


@app.post("/api/pwd/suitability-match")
async def pwd_suitability_match(req: SearchRequest, user: dict = Depends(RoleChecker(['user']))):
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Fetch full profile from DB
    cursor.execute("SELECT * FROM users WHERE id = %s", (user['id'],))
    user_profile = dict(cursor.fetchone())
    
    if not req.use_profile_context:
        query = req.search_query.strip()
        if query:
            like_query = f"%{query}%"
            cursor.execute(
                """SELECT * FROM jobs 
                   WHERE status = 'approved' AND 
                   (job_title ILIKE %s OR employer_name ILIKE %s OR job_description ILIKE %s OR structured_skills ILIKE %s OR location ILIKE %s OR salary_range ILIKE %s)
                   ORDER BY id DESC""",
                (like_query, like_query, like_query, like_query, like_query, like_query)
            )
        else:
            cursor.execute("SELECT * FROM jobs WHERE status = 'approved' ORDER BY id DESC")
            
        approved_jobs = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        matches = []
        for job in approved_jobs:
            matches.append({
                "job_id": job['id'],
                "employer": job['employer_name'],
                "job_title": job['job_title'],
                "job_description": job['job_description'],
                "physical_requirements": job['physical_requirements'],
                "structured_skills": job['structured_skills'],
                "employer_type": job.get('employer_type', 'Private'),
                "salary_range": job.get('salary_range', 'Negotiable'),
                "benefits": job.get('benefits', ''),
                "job_type": job.get('job_type', 'Full-time'),
                "location": job.get('location', 'Remote/PH'),
                "remote_friendly": bool(job.get('remote_friendly', 0)),
                "work_environment": job.get('work_environment', 'Indoor'),
                "stamina_required": job.get('task_intensity', 'Medium'),
                "matched_skills": [],
                "missing_skills": [],
                "strengths": [],
                "barriers": [],
                "ontology_reasons": [],
                "metrics": {
                    "safety_score": 0.0,
                    "skill_score": 0.0,
                    "stamina_score": 0.0,
                    "ontology_score": 0.0,
                    "final_accessibility_percentage": 0.0
                }
            })
        return {"message": "Manual search results", "matches": matches}
        
    # Prepare profile data for capability matching
    disabilities = json.loads(user_profile.get('disabilities', '[]'))
    capabilities = build_capability_profile(
        user_profile.get('disability_profile'), disabilities
    )
    
    # Disability-blind embedding context: qualifications only.
    # Protected attributes (disabilities / physical_capabilities) never enter
    # the learned model; they feed only the transparent capability engine.
    pwd_context_parts = []
    if req.search_query.strip():
        pwd_context_parts.append(f"Ideal Job Query: {req.search_query.strip()}")
    
    if req.use_profile_context:
        quals = build_qualification_context(user_profile)
        if quals and quals != "General Job Search":
            pwd_context_parts.append(quals)
        if user_profile.get('projects'): pwd_context_parts.append(f"Projects: {user_profile['projects']}")
        if user_profile.get('certifications'): pwd_context_parts.append(f"Certifications: {user_profile['certifications']}")
        if user_profile.get('awards'): pwd_context_parts.append(f"Awards: {user_profile['awards']}")
        
    pwd_context = " ".join(pwd_context_parts) if pwd_context_parts else "General Job Search"
    
    pwd_vector_np = model.encode(pwd_context, convert_to_numpy=True).astype('float32')
    norm = np.linalg.norm(pwd_vector_np)
    if norm > 0:
        pwd_vector_np = pwd_vector_np / norm
    pwd_vector_list = pwd_vector_np.flatten().tolist()

    # --- 3. NATIVE PGVECTOR COSINE RETRIEVAL (HNSW-Accelerated Top-30) ---
    max_k = 30
    cursor.execute("""
        SELECT *, 1 - (embedding <=> %s::vector) AS cos_sim
        FROM jobs 
        WHERE status = 'approved' AND embedding IS NOT NULL
        ORDER BY embedding <=> %s::vector ASC
        LIMIT %s
    """, (json.dumps(pwd_vector_list), json.dumps(pwd_vector_list), max_k))
    top_candidates = [dict(row) for row in cursor.fetchall()]

    if not top_candidates:
        conn.close()
        return {"message": "No approved jobs with valid vector embeddings found.", "matches": []}

    k = len(top_candidates)
    valid_jobs = top_candidates
    distances = [[float(c.get('cos_sim') or 0.0) for c in top_candidates]]
    indices = [[i for i in range(k)]]

    # --- 3.5 CROSS-ENCODER RE-RANKING (Precision Vocational Alignment) ---
    print(f"[INFO] Re-ranking {k} candidates with Cross-Encoder...")
    pairs = []
    for i in range(k):
        job = valid_jobs[indices[0][i]]
        job_summary = f"{job['job_title']}. {job['job_description']}"
        pairs.append([pwd_context, job_summary])

    if pairs:
        raw_cross_scores = cross_model.predict(pairs)
        # MS-MARCO Cross-Encoder calibration for document-level matching:
        # Map logit range [-10.0, 0.0+] linearly onto [0.0, 100.0]
        cross_scores = [min(100.0, max(0.0, ((float(z) + 10.0) / 10.0) * 100)) for z in raw_cross_scores]
    else:
        cross_scores = []

    # Clean user skills into a set (Combine explicit skills + summary for semantic breadth)
    combined_user_text = f"{user_profile.get('skills') or ''} {user_profile.get('summary') or ''}".lower()
    # Extract all words 3+ chars as potential keywords
    pwd_skills_set = set(re.findall(r'\b\w{3,}\b', combined_user_text))
    # Also keep comma-separated ones specifically
    if user_profile.get('skills'):
        pwd_skills_set.update([s.strip().lower() for s in user_profile.get('skills').split(",") if s.strip()])
    matches = []
    
    # Extract working capacity
    user_caps = user_profile.get('physical_capabilities') or ""
    hour_match = re.search(r'(\d+)\s*hour', user_caps.lower())
    user_hours = int(hour_match.group(1)) if hour_match else 8
    
    for i in range(k):
        job_idx = indices[0][i]
        cos_sim = distances[0][i] 
        job = valid_jobs[job_idx]
        
        # Skill extraction & overlap
        job_req_skills = set([s.strip().lower() for s in (job.get('structured_skills') or '').split(",") if s.strip()])
        if job_req_skills:
            overlap = list(pwd_skills_set.intersection(job_req_skills))
            missing_skills = list(job_req_skills - pwd_skills_set)
            kw_score = (len(overlap) / max(1, len(job_req_skills))) * 100
        else:
            job_desc_set = set(re.findall(r'\b\w{2,}\b', (job.get('job_description') or '').lower()))
            overlap = list(pwd_skills_set.intersection(job_desc_set))
            missing_skills = []
            kw_score = (len(overlap) / max(1, len(pwd_skills_set))) * 100 if pwd_skills_set else 40.0
        
        # 1. Capability Compatibility Score (from 9-dimension ergonomic matrix)
        compat = score_job_compatibility(user_profile, job, capabilities=capabilities, overlap_skills=overlap)
        ontology_score = compat["score"]
        ontology_reasons = compat["reasons"]

        # 2. Physical Safety Score (Grounded in Ergonomics & BP 344 Accommodations)
        phys_ex = next((e for e in compat.get('explanations', []) if e.get('dimension_key') == 'physical'), None)
        sens_ex = next((e for e in compat.get('explanations', []) if e.get('dimension_key') == 'sensory'), None)
        fine_ex = next((e for e in compat.get('explanations', []) if e.get('dimension_key') == 'fine_motor'), None)
        
        base_safety = float(np.mean([
            phys_ex['score'] if phys_ex else 80.0,
            sens_ex['score'] if sens_ex else 80.0,
            fine_ex['score'] if fine_ex else 80.0
        ]))
        
        phys_req_text = (job.get('physical_requirements') or '').lower()
        acc_features = (job.get('accessibility_features') or '').lower()
        combined_acc = phys_req_text + " " + acc_features
        dis_str = str(disabilities).lower()
        
        if "wheelchair" in dis_str and any(w in combined_acc for w in ["wheelchair", "seated", "ramp", "elevator", "level floor"]):
            safety_score = max(base_safety, 95.0)
        elif phys_ex and phys_ex.get('verdict') == 'mismatch':
            safety_score = min(base_safety, 30.0)
        else:
            safety_score = base_safety

        # 3. Sustainability Score (Task Intensity & Tempo vs User Preference)
        job_intensity = job.get('task_intensity', 'Medium')
        user_pref = user_profile.get('preferred_intensity', 'Medium')
        intensity_map = {"Low": 1, "Medium": 2, "High": 3}
        j_int = intensity_map.get(job_intensity, 2)
        u_pref = intensity_map.get(user_pref, 2)
        stamina_score = 100.0 if j_int <= u_pref else max(0.0, 100.0 - (j_int - u_pref) * 25.0)

        # 4. Skill Alignment Score (Keyword Overlap + Cross-Encoder Relevance + Bi-Encoder Semantic Boost)
        raw_sim = float(cos_sim)
        bi_score = min(100.0, max(0.0, (raw_sim - 0.25) / 0.5 * 100))
        cross_voc_score = float(cross_scores[i]) if i < len(cross_scores) else bi_score
        
        skill_score = (kw_score * 0.35) + (cross_voc_score * 0.45) + (bi_score * 0.20)
        skill_score = min(100.0, max(15.0, skill_score))

        # FINAL HYBRID SCORE
        w_safety = user_profile.get('safety_weight', 0.5)
        w_skill = user_profile.get('skill_weight', 0.5)
        w_stamina = user_profile.get('stamina_weight', 0.5)
        w_ontology = 0.5
        
        total_weight = w_safety + w_skill + w_stamina + w_ontology
        if total_weight <= 0:
            total_weight = 1.0
            
        final_accessibility_percentage = ((safety_score * w_safety) + (skill_score * w_skill) + (stamina_score * w_stamina) + (ontology_score * w_ontology)) / total_weight
        
        print(f"[DEBUG] Job: {job['job_title']}")
        print(f"        - Physical Safety:    {safety_score:.1f}% (Weight: {w_safety:.2f})")
        print(f"        - Skill Alignment:    {skill_score:.1f}% (Weight: {w_skill:.2f})")
        print(f"        - Stamina/Tempo:      {stamina_score:.1f}% (Weight: {w_stamina:.2f})")
        print(f"        - Capability Fit:     {ontology_score:.1f}% (Weight: {w_ontology:.2f})")
        print(f"        - FINAL SCORE:        {final_accessibility_percentage:.1f}%")

        matches.append({
            "job_id": job['id'],
            "employer": job['employer_name'],
            "job_title": job['job_title'],
            "job_description": job['job_description'],
            "physical_requirements": job['physical_requirements'],
            "structured_skills": job['structured_skills'],
            "employer_type": job.get('employer_type', 'Private'),
            "salary_range": job.get('salary_range', 'Negotiable'),
            "benefits": job.get('benefits', ''),
            "job_type": job.get('job_type', 'Full-time'),
            "location": job.get('location', 'Remote/PH'),
            "remote_friendly": bool(job.get('remote_friendly', 0)),
            "work_environment": job.get('work_environment', 'Indoor'),
            "stamina_required": job.get('task_intensity', 'Medium'),
            "matched_skills": overlap,
            "missing_skills": missing_skills,
            "pros_summary": compat.get("pros_summary", ""),
            "cons_summary": compat.get("cons_summary", ""),
            "suitability_summary": compat.get("suitability_summary", ""),
            "strengths": compat["strengths"],
            "plain_strengths": compat.get("plain_strengths", []),
            "barriers": compat["barriers"],
            "plain_barriers": compat.get("plain_barriers", []),
            "accommodations": compat["accommodations"],
            "ontology_reasons": ontology_reasons,
            "plain_reasons": compat.get("plain_reasons", []),
            "explanations": compat.get("explanations", []),
            "narrative": compat.get("narrative"),
            "suitability_index": compute_suitability_index(job, ontology_score),
            "metrics": {
                "safety_score": round(safety_score, 1),
                "skill_score": round(skill_score, 1),
                "stamina_score": round(stamina_score, 1),
                "ontology_score": round(ontology_score, 1),
                "final_accessibility_percentage": round(final_accessibility_percentage, 1)
            }
        })
            
    # Apply query relevance boost if search query provided
    q_lower = (req.search_query or '').strip().lower()
    if q_lower:
        for m in matches:
            title_hit = q_lower in m['job_title'].lower()
            emp_hit = q_lower in (m.get('employer') or '').lower()
            loc_hit = q_lower in (m.get('location') or '').lower()
            skills_hit = q_lower in (m.get('structured_skills') or '').lower() or any(q_lower in s.lower() for s in m.get('matched_skills', []))
            desc_hit = q_lower in (m.get('job_description') or '').lower()
            
            bonus = 0.0
            if title_hit:
                bonus += 25.0
            elif emp_hit or loc_hit or skills_hit:
                bonus += 15.0
            elif desc_hit:
                bonus += 8.0
                
            if bonus > 0:
                cur_score = m["metrics"]["final_accessibility_percentage"]
                m["metrics"]["final_accessibility_percentage"] = min(100.0, round(cur_score + bonus, 1))

    # Sort and take top 10
    matches.sort(key=lambda x: x["metrics"]["final_accessibility_percentage"], reverse=True)
    matches = matches[:10]

    # Log each match result to match_logs for AIF360 fairness auditing
    # (NCDA AO No. 001 s.2021 — demographic parity across 11 disability types)
    for m in matches:
        try:
            log_match(
                user_id=user['id'],
                disabilities=disabilities,
                scores=m["metrics"],
                job_id=m.get("job_id"),
                cursor=conn.cursor(cursor_factory=RealDictCursor),
            )
        except Exception as log_err:
            print(f"[WARN] Fairness log_match failed: {log_err}")

    conn.commit()
    conn.close()

    return {
        "applicant": user_profile.get('name', 'User'),
        "total_safe_matches": len(matches),
        "matches": matches,
    }

@app.get("/api/pwd/job-analysis/{job_id}")
async def get_job_analysis(job_id: str, user: dict = Depends(RoleChecker(['user']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Fetch job and user profile
    cursor.execute("SELECT * FROM jobs WHERE id = %s", (job_id,))
    job = cursor.fetchone()
    cursor.execute("SELECT * FROM users WHERE id = %s", (user['id'],))
    user_profile = cursor.fetchone()
    conn.close()
    
    if not job or not user_profile:
        raise HTTPException(status_code=404, detail="Job or User not found")
        
    job = dict(job)
    user_profile = dict(user_profile)
    
    # Re-calculate the actual scores for high-explainability grounding
    disabilities = json.loads(user_profile.get('disabilities', '[]'))
    
    # 1. Physical Safety Score (disability-blind qualification context)
    pwd_context = build_qualification_context(user_profile)
    
    try:
        u_vec = model.encode(pwd_context, convert_to_numpy=True)
        emb = job['embedding']
        if isinstance(emb, str):
            j_vec = np.array(json.loads(emb))
        elif isinstance(emb, np.ndarray):
            j_vec = emb
        elif isinstance(emb, list):
            j_vec = np.array(emb)
        else:
            j_vec = None
            
        if j_vec is not None:
            # Cosine similarity
            cos_sim = np.dot(u_vec, j_vec) / (np.linalg.norm(u_vec) * np.linalg.norm(j_vec))
            bi_score = min(100.0, max(0.0, (float(cos_sim) - 0.25) / 0.5 * 100))
        else:
            bi_score = 50.0
            
        raw_cross = cross_model.predict([[pwd_context, job['physical_requirements']]])[0]
        cross_score = (1 / (1 + np.exp(-(float(raw_cross) + 1.5) / 1.2))) * 100
        safety_score = (bi_score * 0.30) + (cross_score * 0.70)
    except Exception as e:
        print(f"[WARN] Failed to calculate dynamic safety score: {e}")
        safety_score = 85.0
        bi_score = 80.0
        
    # 2. Sustainability Score (grounded in the capability profile, not stale columns)
    capabilities = build_capability_profile(
        user_profile.get('disability_profile'), disabilities
    )
    job_intensity = job.get('task_intensity', 'Medium')
    user_pref = capabilities.get('preferred_intensity', 'Medium')
    
    stamina_score = 100.0
    intensity_map = {"Low": 1, "Medium": 2, "High": 3}
    j_int = intensity_map.get(job_intensity, 2)
    u_pref = intensity_map.get(user_pref, 2)
    
    if j_int > u_pref:
        stamina_score -= (j_int - u_pref) * 25
    stamina_score = max(0.0, min(100.0, stamina_score))
    
    # 3. Skill Alignment Score
    combined_user_text = f"{user_profile.get('skills') or ''} {user_profile.get('summary') or ''}".lower()
    pwd_skills_set = set(re.findall(r'\b\w{3,}\b', combined_user_text))
    if user_profile.get('skills'):
        pwd_skills_set.update([s.strip().lower() for s in user_profile.get('skills').split(",") if s.strip()])
        
    job_req_skills = set([s.strip().lower() for s in job.get('structured_skills', '').split(",") if s.strip()])
    if job_req_skills:
        overlap = list(pwd_skills_set.intersection(job_req_skills))
        skill_score = (len(overlap) / max(1, len(job_req_skills))) * 100
    else:
        job_desc_set = set(re.findall(r'\b\w{2,}\b', job['job_description'].lower()))
        overlap = list(pwd_skills_set.intersection(job_desc_set))
        skill_score = (len(overlap) / max(1, len(pwd_skills_set))) * 100
        
    skill_score = (skill_score * 0.5) + (bi_score * 0.5)
    if bi_score > 50:
        skill_score = max(skill_score, 40.0)
    skill_score = min(100.0, skill_score)
    
    # 4. Capability Compatibility Score (replaces the coarse category ontology)
    compat = score_job_compatibility(user_profile, job, capabilities=capabilities, overlap_skills=overlap)
    ontology_score = compat["score"]
    ontology_reasons = compat["reasons"]
    
    # Ground the context using the formal compatibility findings to prioritize explainability
    user_context = (
        f"Background: {user_profile.get('skills', 'No skills listed')}. "
        f"Education: {format_education(user_profile.get('education')) or 'N/A'}. "
        f"Capability-Based Compatibility Findings: {'; '.join(ontology_reasons)}"
    )
    job_context = f"{job['job_title']} at {job['employer_name']}. Requires: {job['physical_requirements']}"
    
    # Pass the actual calculated metrics including the compatibility score and reasons
    report = generate_ai_report({
        "safety": safety_score, 
        "skills": skill_score, 
        "stamina": stamina_score, 
        "ontology": ontology_score
    }, user_context, job_context, compat["facts"], ontology_reasons=ontology_reasons)
    
    return {
        "analysis": report,
        "pros_summary": compat.get("pros_summary", ""),
        "cons_summary": compat.get("cons_summary", ""),
        "suitability_summary": compat.get("suitability_summary", ""),
        "strengths": compat["strengths"],
        "plain_strengths": compat.get("plain_strengths", []),
        "barriers": compat["barriers"],
        "plain_barriers": compat.get("plain_barriers", []),
        "accommodations": compat["accommodations"],
        "ontology_reasons": ontology_reasons,
        "plain_reasons": compat.get("plain_reasons", []),
        "explanations": compat.get("explanations", []),
        "narrative": compat.get("narrative"),
        "suitability_index": compute_suitability_index(job, ontology_score)
    }

@app.get("/api/schools")
async def search_schools(q: str = "", level: str = ""):
    """Autocomplete for legitimate Philippine schools (curated CHED/DepEd subset)."""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    query = "SELECT name, level, city, region FROM ph_schools WHERE 1=1"
    params = []
    if q.strip():
        query += " AND name ILIKE %s"
        params.append(f"%{q.strip()}%")
    if level in ("Basic", "Tertiary"):
        query += " AND level = %s"
        params.append(level)
    query += " ORDER BY name LIMIT 10"
    cursor.execute(query, params)
    schools = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"schools": schools}

@app.get("/api/public/jobs")
async def get_public_jobs():
    """Fetch all approved jobs for public listing without authentication."""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT id, employer_name, job_title, job_description, physical_requirements,
               task_intensity, has_flexibility, structured_skills, employer_type,
               salary_range, benefits, job_type, location, status_reason,
               accessibility_features, work_environment, work_tempo,
               cognitive_load, sensory_load, social_interaction, remote_friendly,
               visual_demand, auditory_demand, fine_motor_demand, physical_demand
        FROM jobs 
        WHERE status = 'approved'
    """)
    jobs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    # stamina_required is derived from task_intensity (single source of truth)
    for j in jobs:
        j['stamina_required'] = j.get('task_intensity') or 'Medium'
    return jobs

@app.get("/api/public/jobs/{job_id}")
async def get_public_job_details(job_id: str):
    """Fetch details of a single approved job for public view."""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT id, employer_name, job_title, job_description, physical_requirements,
               task_intensity, has_flexibility, structured_skills, employer_type,
               salary_range, benefits, job_type, location, status_reason,
               accessibility_features, work_environment, work_tempo,
               cognitive_load, sensory_load, social_interaction, remote_friendly,
               visual_demand, auditory_demand, fine_motor_demand, physical_demand
        FROM jobs 
        WHERE id = %s AND status = 'approved'
    """, (job_id,))
    job = cursor.fetchone()
    conn.close()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not approved")
    job = dict(job)
    job['stamina_required'] = job.get('task_intensity') or 'Medium'
    return job

# --- APPLICATION SYSTEM ---

@app.get("/api/jobs/{job_id}")
async def get_job_details(job_id: str, user: dict = Depends(RoleChecker(['user']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM jobs WHERE id = %s", (job_id,))
    job = cursor.fetchone()
    conn.close()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    job = dict(job)
    job.pop('embedding', None)
    # Add dummy contacts and benefits if missing
    job['contacts'] = ["hr@employer.com", "+63 912 345 6789"]
    job['benefits'] = job.get('benefits', 'Standard Benefits, Medical, SL/VL')
    return job

@app.post("/api/applications")
async def submit_application(data: dict, user: dict = Depends(RoleChecker(['user']))):
    job_id = data.get('job_id')
    resume_data = data.get('resume_data', '')
    resume_source = data.get('resume_source', '')  # "auto" | "upload" | ""
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Check if already applied
    cursor.execute("SELECT id FROM applications WHERE user_id = %s AND job_id = %s", (user['id'], job_id))
    if cursor.fetchone():
        conn.close()
        return {"message": "Already applied"}

    # Generate resume if source is "auto" or user has auto_generate_resume enabled
    should_generate = (resume_source == "auto")
    if not should_generate and not resume_data:
        cursor.execute("SELECT auto_generate_resume FROM users WHERE id = %s", (user['id'],))
        user_row = cursor.fetchone()
        if user_row and user_row['auto_generate_resume']:
            should_generate = True

    if should_generate:
        try:
            cursor.execute("""
                SELECT id, email, name, role, summary, skills, 
                       education, experience, projects, certifications, awards
                FROM users WHERE id = %s
            """, (user['id'],))
            profile = dict(cursor.fetchone())
            cursor.execute("SELECT value FROM system_settings WHERE key = 'resume_theme'")
            theme_row = cursor.fetchone()
            theme = theme_row['value'] if theme_row else 'classic'
            resume_result = generate_resume(profile, theme)
            if resume_result:
                resume_data = resume_result
        except Exception as e:
            print(f"[WARN] Auto-resume generation failed: {e}")

    cursor.execute("""
        INSERT INTO applications (user_id, job_id, status, applied_at, resume_data)
        VALUES (%s, %s, 'Pending', %s, %s)
    """, (user['id'], job_id, datetime.now().isoformat(), resume_data))
    
    conn.commit()
    conn.close()
    return {"message": "Application submitted successfully"}

@app.get("/api/applications")
async def get_my_applications(user: dict = Depends(RoleChecker(['user']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT a.*, j.job_title, j.employer_name 
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.user_id = %s
        ORDER BY a.applied_at DESC
    """, (user['id'],))
    apps = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return apps

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
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get or create seeded employer
    cursor.execute("SELECT id FROM users WHERE email = 'employer@uplift.com'")
    emp_row = cursor.fetchone()
    if emp_row:
        employer_id = emp_row['id']
    else:
        employer_id = str(uuid.uuid4())
        pw_hash = hash_password("employer123")
        cursor.execute(
            "INSERT INTO users (id, email, password_hash, name, role, status, verification_data) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (employer_id, 'employer@uplift.com', pw_hash, 'Makati BPO Solutions', 'employer', 'active', '{}')
        )
        
    for job in demo_jobs:
        job_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO jobs (id, employer_id, employer_name, employer_type, job_title, job_type, salary_range, location, benefits, job_description, physical_requirements, accessibility_features, work_environment, work_tempo, status) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'approved')
        """, (
            job_id, employer_id, job['employer_name'], job['employer_type'], job['job_title'], job['job_type'], 
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

# ==========================================
# 8. EMPLOYER PORTAL API
# ==========================================

class JobStatusUpdate(BaseModel):
    status: str
    reason: str = ""

class ApplicationAction(BaseModel):
    status: str
    notes: str = ""

@app.get("/api/employer/stats")
async def get_employer_stats(user: dict = Depends(check_active_employer)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get counts for this specific employer
    cursor.execute("SELECT COUNT(*) as count FROM jobs WHERE employer_id = %s", (user['id'],))
    job_count = cursor.fetchone()['count']
    
    cursor.execute("""
        SELECT COUNT(*) as count 
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE j.employer_id = %s
    """, (user['id'],))
    app_count = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) as count FROM jobs WHERE employer_id = %s AND status = 'full'", (user['id'],))
    fulfilled_count = cursor.fetchone()['count']
    
    return {
        "job_count": job_count,
        "app_count": app_count,
        "fulfilled_count": fulfilled_count
    }

@app.get("/api/employer/jobs")
async def get_employer_jobs(user: dict = Depends(check_active_employer)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM jobs WHERE employer_id = %s ORDER BY id DESC", (user['id'],))
    jobs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    for j in jobs:
        j.pop('embedding', None)
    return {"jobs": jobs}

@app.post("/api/employer/jobs")
async def create_employer_job(req: JobSubmission, user: dict = Depends(check_active_employer)):
    job_id = str(uuid.uuid4())[:8]
    
    # Generate Embedding for semantic search
    job_context = f"{req.job_title}. Requirements: {req.physical_requirements}. Description: {req.job_description}"
    embedding = model.encode([job_context])[0].tolist()
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        INSERT INTO jobs (
            id, employer_name, employer_id, job_title, job_description, 
            physical_requirements, status, embedding, employer_type,
            salary_range, benefits, job_type, location, structured_skills,
            cognitive_load, sensory_load, social_interaction, has_flexibility,
            remote_friendly, visual_demand, auditory_demand,
            fine_motor_demand, physical_demand
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        job_id, user['name'], user['id'], req.job_title, req.job_description,
        req.physical_requirements, 'pending', json.dumps(embedding), req.employer_type,
        req.salary_range, req.benefits, req.job_type, req.location, "",
        req.cognitive_load, req.sensory_load, req.social_interaction,
        1 if req.has_flexibility else 0, 1 if req.remote_friendly else 0,
        req.visual_demand, req.auditory_demand,
        req.fine_motor_demand, req.physical_demand
    ))
    conn.commit()
    return {"job_id": job_id, "status": "pending"}

@app.patch("/api/employer/jobs/{job_id}/status")
async def update_job_status(job_id: str, req: JobStatusUpdate, user: dict = Depends(check_active_employer)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("UPDATE jobs SET status = %s, status_reason = %s WHERE id = %s AND employer_id = %s", 
                   (req.status, req.reason, job_id, user['id']))
    conn.commit()
    return {"status": "success"}

class EmployerProfileUpdate(BaseModel):
    name: str
    summary: str = ""

@app.put("/api/employer/profile")
async def update_employer_profile(req: EmployerProfileUpdate, user: dict = Depends(check_active_employer)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        "UPDATE users SET name = %s, summary = %s WHERE id = %s",
        (req.name, req.summary, user['id'])
    )
    conn.commit()
    conn.close()
    return {"message": "Profile updated successfully."}

@app.delete("/api/employer/jobs/{job_id}")
async def delete_employer_job(job_id: str, user: dict = Depends(check_active_employer)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT employer_id FROM jobs WHERE id = %s", (job_id,))
    job = cursor.fetchone()
    if not job:
        conn.close()
        raise HTTPException(status_code=404, detail="Job not found")
    if job['employer_id'] != user['id']:
        conn.close()
        raise HTTPException(status_code=403, detail="Not authorized to delete this job")
        
    cursor.execute("DELETE FROM jobs WHERE id = %s", (job_id,))
    conn.commit()
    conn.close()
    return {"message": "Job deleted successfully."}

@app.put("/api/employer/jobs/{job_id}")
async def update_employer_job(job_id: str, job: JobSubmission, user: dict = Depends(check_active_employer)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT employer_id FROM jobs WHERE id = %s", (job_id,))
    existing_job = cursor.fetchone()
    if not existing_job:
        conn.close()
        raise HTTPException(status_code=404, detail="Job not found")
    if existing_job['employer_id'] != user['id']:
        conn.close()
        raise HTTPException(status_code=403, detail="Not authorized to edit this job")
        
    job_context = f"{job.job_title}. Requirements: {job.physical_requirements}. Description: {job.job_description}"
    embedding = model.encode([job_context])[0].tolist()
    
    cursor.execute("""
        UPDATE jobs SET 
            job_title = %s, job_description = %s, physical_requirements = %s,
            employer_type = %s, salary_range = %s, benefits = %s, job_type = %s,
            location = %s, accessibility_features = %s, work_environment = %s,
            work_tempo = %s, structured_skills = %s,
            cognitive_load = %s, sensory_load = %s, social_interaction = %s,
            has_flexibility = %s, remote_friendly = %s, visual_demand = %s,
            auditory_demand = %s, fine_motor_demand = %s, physical_demand = %s,
            embedding = %s
        WHERE id = %s
    """, (
        job.job_title, job.job_description, job.physical_requirements,
        job.employer_type, job.salary_range, job.benefits, job.job_type,
        job.location, job.accessibility_features, job.work_environment,
        job.work_tempo, job.structured_skills,
        job.cognitive_load, job.sensory_load, job.social_interaction,
        1 if job.has_flexibility else 0, 1 if job.remote_friendly else 0,
        job.visual_demand, job.auditory_demand,
        job.fine_motor_demand, job.physical_demand, json.dumps(embedding),
        job_id
    ))
    conn.commit()
    conn.close()
    return {"message": "Job updated successfully."}

@app.get("/api/employer/candidates/{pwd_id}")
async def get_candidate_profile(pwd_id: str, user: dict = Depends(check_active_employer)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT id, email, name, summary, skills, disabilities, 
               physical_capabilities, preferred_intensity, requires_flexibility,
               education, experience, projects, certifications, awards
        FROM users WHERE id = %s AND role = 'user'
    """, (pwd_id,))
    candidate = cursor.fetchone()
    conn.close()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    candidate = dict(candidate)
    try:
        candidate['disabilities'] = json.loads(candidate['disabilities']) if candidate['disabilities'] else []
    except:
        candidate['disabilities'] = []
        
    return candidate

@app.get("/api/employer/candidates/{pwd_id}/resume")
async def get_candidate_resume_employer(pwd_id: str, user: dict = Depends(check_active_employer)):
    """Generate or retrieve RenderCV resume for a candidate on demand."""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Check if candidate already has an application with resume_data
    cursor.execute("""
        SELECT a.resume_data FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.user_id = %s AND j.employer_id = %s AND a.resume_data IS NOT NULL
        LIMIT 1
    """, (pwd_id, user['id']))
    app_row = cursor.fetchone()
    if app_row and app_row.get('resume_data'):
        conn.close()
        return {"success": True, "resume_base64": app_row['resume_data']}
        
    # 2. Otherwise generate from candidate profile on demand
    cursor.execute("""
        SELECT id, email, name, role, summary, skills, 
               education, experience, projects, certifications, awards
        FROM users WHERE id = %s AND role = 'user'
    """, (pwd_id,))
    profile = cursor.fetchone()
    
    cursor.execute("SELECT value FROM system_settings WHERE key = 'resume_theme'")
    theme_row = cursor.fetchone()
    theme = theme_row['value'] if theme_row else 'classic'
    conn.close()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    result = generate_resume(dict(profile), theme)
    if result:
        try:
            conn2 = get_db_connection()
            cur2 = conn2.cursor()
            cur2.execute("""
                UPDATE applications SET resume_data = %s
                WHERE user_id = %s AND resume_data IS NULL
            """, (result, pwd_id))
            conn2.commit()
            conn2.close()
        except:
            pass
        return {"success": True, "resume_base64": result}
    else:
        raise HTTPException(status_code=500, detail="Failed to compile RenderCV resume")

@app.get("/api/employer/applications")
async def get_employer_applications(user: dict = Depends(check_active_employer)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT a.*, u.name as applicant_name, u.email as applicant_email, 
               u.summary, u.skills, u.disabilities, u.physical_capabilities,
               j.job_title
        FROM applications a
        JOIN users u ON a.user_id = u.id
        JOIN jobs j ON a.job_id = j.id
        WHERE j.employer_id = %s
        ORDER BY a.applied_at DESC
    """, (user['id'],))
    return {"applications": [dict(r) for r in cursor.fetchall()]}

@app.patch("/api/employer/applications/{app_id}")
async def action_application(app_id: str, req: ApplicationAction, user: dict = Depends(check_active_employer)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    # Verify the application belongs to this employer's job
    cursor.execute("""
        SELECT a.id FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.id = %s AND j.employer_id = %s
    """, (app_id, user['id']))
    if not cursor.fetchone():
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    cursor.execute("UPDATE applications SET status = %s, employer_notes = %s WHERE id = %s", 
                   (req.status, req.notes, app_id))
    conn.commit()
    return {"status": "success"}

@app.post("/api/employer/verify")
async def submit_verification(req: dict, user: dict = Depends(RoleChecker(['employer']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        UPDATE users 
        SET name = %s, status = 'pending', rejection_reason = '', verification_data = %s 
        WHERE id = %s
    """, (req.get('company_name') or req.get('contact_person') or user['name'], json.dumps(req), user['id']))
    conn.commit()
    conn.close()
    return {"status": "success"}

# ==========================================
# 9. RESUME GENERATION (RenderCV)
# ==========================================

@app.post("/api/resume/generate")
async def generate_resume_endpoint(user: dict = Depends(RoleChecker(['user']))):
    """Generate an ATS-friendly PDF resume for the current user."""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("""
        SELECT id, email, name, role, summary, skills, 
               education, experience, projects, certifications, awards
        FROM users WHERE id = %s
    """, (user['id'],))
    profile = cursor.fetchone()
    
    cursor.execute("SELECT value FROM system_settings WHERE key = 'resume_theme'")
    theme_row = cursor.fetchone()
    theme = theme_row['value'] if theme_row else 'classic'
    
    conn.close()
    
    if not profile:
        return {"success": False, "error": "User not found"}
    
    result = generate_resume(dict(profile), theme)
    if result:
        return {"success": True, "resume_base64": result}
    else:
        return {"success": False, "error": "Failed to compile PDF resume with RenderCV/Typst"}

@app.get("/api/admin/resume-settings")
async def get_resume_settings(user: dict = Depends(RoleChecker(['admin']))):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT value FROM system_settings WHERE key = 'resume_theme'")
    row = cursor.fetchone()
    conn.close()
    theme = row['value'] if row else 'classic'
    return {"resume_theme": theme}

@app.put("/api/admin/resume-settings")
async def update_resume_settings(req: dict, user: dict = Depends(RoleChecker(['admin']))):
    theme = req.get('resume_theme', 'classic')
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        INSERT INTO system_settings (key, value) VALUES ('resume_theme', %s)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    """, (theme,))
    conn.commit()
    conn.close()
    return {"resume_theme": theme}

# ==========================================
# 10. RESUME PARSING (pydparser Engine)
# ==========================================
def parse_resume_document(file_path: str) -> dict:
    """
    Extract structured candidate data from a resume file using pydparser.
    """
    import torch  # Ensure DLL resolution stability
    from pydparser import ResumeParser

    parser = ResumeParser(file_path)
    raw = parser.get_extracted_data() or {}

    # Format skills
    skills_raw = raw.get('skills') or []
    if isinstance(skills_raw, list):
        skills = ", ".join([str(s).strip() for s in skills_raw if s and str(s).strip()])
    else:
        skills = str(skills_raw).strip()

    # Format work experience
    exp_raw = raw.get('experience') or []
    if isinstance(exp_raw, list):
        exp_clean = [str(line).strip() for line in exp_raw if line and str(line).strip()]
        experience = "\n".join(exp_clean)
    else:
        experience = str(exp_raw).strip()

    # Format education
    edu_parts = []
    if raw.get('college_name'):
        colleges = raw['college_name'] if isinstance(raw['college_name'], list) else [raw['college_name']]
        edu_parts.extend([str(c).strip() for c in colleges if c and str(c).strip()])
    if raw.get('degree'):
        degrees = raw['degree'] if isinstance(raw['degree'], list) else [raw['degree']]
        edu_parts.extend([str(d).strip() for d in degrees if d and str(d).strip()])
    education = " - ".join(edu_parts) if edu_parts else ""

    # Format designation & summary
    designation = ""
    if raw.get('designation'):
        desigs = raw['designation'] if isinstance(raw['designation'], list) else [raw['designation']]
        designation = ", ".join([str(d).strip() for d in desigs if d and str(d).strip()])

    summary_parts = []
    if designation:
        summary_parts.append(f"Professional designation: {designation}.")
    if raw.get('total_experience'):
        summary_parts.append(f"Total experience: {raw['total_experience']} years.")
    if skills:
        summary_parts.append(f"Proficient in {skills}.")
    summary = " ".join(summary_parts) if summary_parts else (experience[:250] if experience else "Parsed candidate profile.")

    return {
        "name": raw.get('name') or '',
        "email": raw.get('email') or '',
        "mobile_number": raw.get('mobile_number') or '',
        "skills": skills,
        "education": education,
        "experience": experience,
        "designation": designation,
        "total_experience": raw.get('total_experience') or 0,
        "summary": summary
    }


@app.post("/api/resume/parse")
async def parse_resume_endpoint(
    file: UploadFile = File(...),
    user: dict = Depends(RoleChecker(['user', 'admin']))
):
    """
    Accepts an uploaded resume (PDF, DOCX) and parses structured fields via pydparser.
    """
    filename = file.filename or "resume.pdf"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".pdf", ".docx", ".doc"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a PDF or DOCX file."
        )

    temp_path = None
    try:
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="File size exceeds the 10MB limit.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(contents)
            temp_path = tmp.name

        parsed = parse_resume_document(temp_path)
        return {
            "success": True,
            "filename": filename,
            "data": parsed
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Resume parsing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Resume extraction failed: {str(e)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.post("/api/pwd/verify-doh")
async def verify_pwd_doh(data: dict):
    """
    Verifies the PWD ID Number via the official DOH portal:
    https://pwd.doh.gov.ph/tbl_pwd_id_verificationlist.php
    """
    pwd_id = data.get("pwd_id_number", "").strip()
    if not pwd_id:
        raise HTTPException(status_code=400, detail="PWD ID Number is required")
        
    import requests
    from bs4 import BeautifulSoup
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    url = "https://pwd.doh.gov.ph/tbl_pwd_id_verificationlist.php"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    }
    
    params = {
        "cmd": "search",
        "t": "tbl_pwd_id_verification",
        "z_pwd_id_number": "=",
        "x_pwd_id_number": pwd_id
    }
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10, verify=False)
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"DOH portal responded with status: {response.status_code}")
            
        html_text = response.text
        if "no records found" in html_text.lower():
            return {
                "success": False,
                "verified": False,
                "message": "ID not found in the DOH PRPWD National Registry. Please verify the format."
            }
            
        soup = BeautifulSoup(html_text, "html.parser")
        
        # Locate the table containing results
        table = soup.find("table", class_="ewTable")
        if not table:
            panel = soup.find(id="gmp_tbl_pwd_id_verification")
            if panel:
                table = panel.find("table")
                
        if not table:
            return {
                "success": True,
                "verified": True,
                "message": "PWD ID exists in DOH registry (detailed extraction failed)."
            }
            
        # Parse headers
        headers_list = []
        header_row = table.find("tr", class_="ewTableHeader")
        if not header_row:
            header_row = table.find("tr")
        if header_row:
            headers_list = [th.get_text(strip=True) for th in header_row.find_all(["th", "td"])]
            
        # Parse data rows
        data_rows = table.find_all("tr", class_=["ewTableRow", "ewTableAltRow"])
        if not data_rows:
            all_rows = table.find_all("tr")
            if len(all_rows) > 1:
                data_rows = all_rows[1:]
                
        if not data_rows:
            return {
                "success": True,
                "verified": True,
                "message": "PWD ID exists in DOH registry (no details returned)."
            }
            
        first_row = data_rows[0]
        cells = [td.get_text(strip=True) for td in first_row.find_all("td")]
        
        # Map headers to cells
        record = {}
        for idx, cell in enumerate(cells):
            header_name = headers_list[idx] if idx < len(headers_list) else f"column_{idx}"
            header_name = header_name.lower().replace(" ", "_").replace(".", "").replace("/", "_")
            record[header_name] = cell
            
        # Standardize return dictionary values
        name_parts = []
        if "first_name" in record: name_parts.append(record["first_name"])
        if "middle_name" in record: name_parts.append(record["middle_name"])
        if "last_name" in record: name_parts.append(record["last_name"])
        
        full_name = " ".join(name_parts) if name_parts else record.get("name", record.get("full_name", ""))
        
        scanned_data = {
            "id_number": record.get("pwd_id_number", pwd_id),
            "pwd_id_reference": pwd_id,
            "full_name": full_name or "Registered PWD Member",
            "disability_type": record.get("type_of_disability", "Verified"),
            "disability_subtype": record.get("disability_details", "Verified"),
            "date_issued": record.get("date_issued", ""),
            "expiry_date": record.get("expiry_date", record.get("date_of_expiration", "")),
            "issuing_office": record.get("issuing_office", record.get("place_issued", "LGU PDAO")),
            "ncda_ao_compliance": "NCDA AO No. 001, Series of 2021"
        }
        
        return {
            "success": True,
            "verified": True,
            "message": "PWD ID successfully verified against the official DOH PRPWD National Registry.",
            "scanned_data": scanned_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DOH Registry Verification failed: {e}")

# Serve frontend static files from built React app
frontend_dist_path = "frontend/dist"
if os.path.exists(frontend_dist_path):
    app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="frontend")

if __name__ == "__main__":
    init_db()
    seed_admin()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
