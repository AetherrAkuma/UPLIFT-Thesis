"""
Re-vectorize all jobs that lack embeddings (or all jobs with --all).
Run from the project root:
    .venv/Scripts/python reindex_jobs.py           # un-vectorized only
    .venv/Scripts/python reindex_jobs.py --all     # force re-index everything
    .venv/Scripts/python reindex_jobs.py --dry-run # preview only
"""
import argparse
import json
import os
import re
import sys
import warnings
import logging

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
warnings.filterwarnings("ignore")
logging.getLogger("sentence_transformers").setLevel(logging.ERROR)

import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector
import torch
import numpy as np
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

def get_conn():
    conn = psycopg2.connect(DB_URI)
    conn.autocommit = False
    register_vector(conn)
    return conn

def load_models():
    from sentence_transformers import SentenceTransformer
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    device = "cuda" if torch.cuda.is_available() else "cpu"
    cache_dir = "./model_cache"
    os.makedirs(cache_dir, exist_ok=True)

    print(f"[INFO] Loading Bi-Encoder on {device}...")
    model = SentenceTransformer('all-MiniLM-L12-v2', cache_folder=cache_dir).to(device)

    print("[INFO] Loading Flan-T5-Base...")
    tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-base", cache_dir=cache_dir)
    gen_model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-base", cache_dir=cache_dir).to(device)

    return model, tokenizer, gen_model, device


def vectorize_job(model, tokenizer, gen_model, device, job):
    job_id = job["id"]
    job_title = job["job_title"] or ""
    employer_name = job["employer_name"] or ""
    job_description = job["job_description"] or ""
    physical_requirements = job["physical_requirements"] or ""
    accessibility = job.get("accessibility_features") or ""
    environment = job.get("work_environment") or ""
    tempo = job.get("work_tempo") or ""

    # --- Embedding ---
    rich_context = (
        f"Job: {job_title} at {employer_name}. "
        f"Requirements: {physical_requirements}. "
        f"Accessibility: {accessibility}. "
        f"Environment: {environment}, Tempo: {tempo}. "
        f"Description: {job_description}."
    )
    embedding_tensor = model.encode(rich_context, convert_to_tensor=False)
    embedding_list = embedding_tensor.tolist()

    # --- Flan-T5 feature extraction ---
    prompt = (
        f"Context: {job_description} {physical_requirements}\n"
        "Question: What is the task intensity (Low, Medium, High)? Does it offer schedule flexibility (Yes, No)? List the professional skills.\n"
        "Answer format: Intensity: [type], Flexibility: [Yes/No], Skills: [comma separated list]"
    )
    inputs = tokenizer(prompt, return_tensors="pt").to(device)
    outputs = gen_model.generate(**inputs, max_new_tokens=100)
    extraction_text = tokenizer.decode(outputs[0], skip_special_tokens=True)

    intensity = "Medium"
    flexibility = 0
    skills = ""
    try:
        int_match = re.search(r'Intensity:\s*(\w+)', extraction_text)
        if int_match:
            intensity = int_match.group(1).strip()

        flex_match = re.search(r'Flexibility:\s*(\w+)', extraction_text)
        if flex_match and flex_match.group(1).lower() == 'yes':
            flexibility = 1

        skill_match = re.search(r'Skills:\s*(.*)', extraction_text)
        if skill_match:
            skills = skill_match.group(1).strip()
    except Exception:
        pass

    return embedding_list, intensity, flexibility, skills


def main():
    parser = argparse.ArgumentParser(description="Re-index jobs with AI embeddings")
    parser.add_argument("--all", action="store_true", help="Re-vectorize ALL jobs, not just un-vectorized ones")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, no DB writes")
    args = parser.parse_args()

    print("[INFO] Connecting to database...")
    conn = get_conn()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    if args.all:
        cursor.execute("SELECT * FROM jobs WHERE status IN ('approved', 'pending') ORDER BY id DESC")
    else:
        cursor.execute("SELECT * FROM jobs WHERE embedding IS NULL AND status IN ('approved', 'pending') ORDER BY id DESC")

    jobs = [dict(row) for row in cursor.fetchall()]
    cursor.close()

    if not jobs:
        print("[INFO] No jobs to re-index.")
        conn.close()
        return

    print(f"[INFO] Found {len(jobs)} job(s) to process.")

    if args.dry_run:
        for j in jobs:
            print(f"  Would index: {j['job_title']} ({j['id'][:8]}) by {j['employer_name']}")
        conn.close()
        return

    model, tokenizer, gen_model, device = load_models()

    success = 0
    for j in jobs:
        try:
            embedding, intensity, flexibility, skills = vectorize_job(
                model, tokenizer, gen_model, device, j
            )
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                "UPDATE jobs SET status = 'approved', embedding = %s, task_intensity = %s, has_flexibility = %s, structured_skills = %s WHERE id = %s",
                (json.dumps(embedding), intensity, flexibility, skills, j["id"])
            )
            conn.commit()
            cur.close()
            success += 1
            print(f"  [{success}/{len(jobs)}] {j['job_title']} — {intensity}, skills: {skills[:40]}")
        except Exception as e:
            print(f"  [FAIL] {j['job_title']} ({j['id'][:8]}): {e}")
            conn.rollback()

    conn.close()
    print(f"[DONE] Indexed {success}/{len(jobs)} jobs.")


if __name__ == "__main__":
    main()
