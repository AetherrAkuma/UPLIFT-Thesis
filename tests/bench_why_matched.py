# ==========================================
# tests/bench_why_matched.py — On-machine bake-off for the "Why matched?" verbalizer
# ==========================================
# Runs the REAL production path on REAL data from the local PostgreSQL `uplift`
# database: deterministic compatibility engine -> grounded plain-language
# rewrite -> verification guard.  Measures wall time, throughput, and guard
# fallbacks for every GGUF found in model_cache/gguf.
#
# Usage:
#   .venv\Scripts\python.exe tests\bench_why_matched.py [--threads 4] [--runs 2]
#
# Results are printed and appended to tests/why_matched_bench_results.md

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO)
os.chdir(REPO)
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import numpy as np
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

load_dotenv(os.path.join(REPO, ".env"))

from compatibility_engine import (
    build_capability_profile,
    build_qualification_context,
    score_job_compatibility,
    compute_physical_safety_score,
    format_education,
    format_experience,
)
from why_matched import build_notes, compose_plain_drafts, generate_why_matched, load_llm

GGUF_DIR = os.path.join(REPO, "model_cache", "gguf")


def get_real_context():
    """Fetch one real PWD user and one real approved job from the database."""
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME", "uplift"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT * FROM users WHERE role='user' AND disability_profile IS NOT NULL "
        "AND disability_profile <> '' ORDER BY created_at LIMIT 1"
    )
    user = dict(cur.fetchone())
    cur.execute(
        "SELECT * FROM jobs WHERE status='approved' AND embedding IS NOT NULL "
        "ORDER BY id LIMIT 1"
    )
    job = dict(cur.fetchone())
    conn.close()
    return user, job


def compute_metrics_and_facts(user, job):
    """Replicates the deterministic computation of GET /api/pwd/job-analysis."""
    from sentence_transformers import SentenceTransformer

    print("[bench] loading bi-encoder for real relevance score...", flush=True)
    emb_model = SentenceTransformer("all-MiniLM-L12-v2", cache_folder="./model_cache", device="cpu")

    disabilities = json.loads(user.get("disabilities") or "[]")
    capabilities = build_capability_profile(user.get("disability_profile"), disabilities)

    pwd_context = build_qualification_context(user)
    bi_score = 50.0
    try:
        u_vec = emb_model.encode(pwd_context, convert_to_numpy=True)
        emb = job["embedding"]
        if isinstance(emb, str):
            j_vec = np.array(json.loads(emb))
        elif isinstance(emb, dict):
            j_vec = np.array(list(emb.values()))
        else:
            j_vec = np.array(emb, dtype=float)
        cos_sim = np.dot(u_vec, j_vec) / (np.linalg.norm(u_vec) * np.linalg.norm(j_vec))
        bi_score = min(100.0, max(0.0, (float(cos_sim) - 0.25) / 0.5 * 100))
    except Exception as e:
        print(f"[bench] bi-encoder step skipped: {e}")

    job_intensity = job.get("task_intensity", "Medium")
    user_pref = capabilities.get("preferred_intensity", "Medium")
    intensity_map = {"Low": 1, "Medium": 2, "High": 3}
    j_int, u_pref = intensity_map.get(job_intensity, 2), intensity_map.get(user_pref, 2)
    stamina_score = 100.0 if j_int <= u_pref else max(0.0, 100.0 - (j_int - u_pref) * 25)

    combined_user_text = f"{user.get('skills') or ''} {user.get('summary') or ''}".lower()
    pwd_skills_set = set(re.findall(r"\b\w{3,}\b", combined_user_text))
    if user.get("skills"):
        pwd_skills_set.update([s.strip().lower() for s in user["skills"].split(",") if s.strip()])

    job_req_skills = set([s.strip().lower() for s in (job.get("structured_skills") or "").split(",") if s.strip()])
    if job_req_skills:
        overlap = list(pwd_skills_set.intersection(job_req_skills))
        skill_score = (len(overlap) / max(1, len(job_req_skills))) * 100
    else:
        job_desc_set = set(re.findall(r"\b\w{2,}\b", (job.get("job_description") or "").lower()))
        overlap = list(pwd_skills_set.intersection(job_desc_set))
        skill_score = (len(overlap) / max(1, len(pwd_skills_set))) * 100

    skill_score = (skill_score * 0.5) + (bi_score * 0.5)
    if bi_score > 50:
        skill_score = max(skill_score, 40.0)
    skill_score = min(100.0, skill_score)

    compat = score_job_compatibility(user, job, capabilities=capabilities, overlap_skills=overlap)
    safety_score = compute_physical_safety_score(job, user, capabilities=capabilities, compat=compat)

    metrics = {
        "safety": safety_score,
        "skills": skill_score,
        "stamina": stamina_score,
        "ontology": compat["score"],
    }
    return metrics, compat, capabilities, overlap


def find_models():
    found = []
    if os.path.isdir(GGUF_DIR):
        for root, _dirs, files in os.walk(GGUF_DIR):
            for f in files:
                path = os.path.join(root, f)
                # skip partial/placeholder downloads (real Q4 files are >300 MB)
                if f.lower().endswith(".gguf") and os.path.getsize(path) > 100 * 1024 * 1024:
                    found.append(path)
    return sorted(found)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--runs", type=int, default=1)
    args = ap.parse_args()

    user, job = get_real_context()
    print(f"[bench] real user: {user.get('name')} ({user.get('id')})")
    print(f"[bench] real job : {job.get('job_title')} at {job.get('employer_name')}")

    metrics, compat, capabilities, overlap = compute_metrics_and_facts(user, job)
    print(f"[bench] metrics  : {json.dumps({k: round(v, 1) for k, v in metrics.items()})}")

    facts = compat["facts"]
    drafts = compose_plain_drafts(
        metrics, facts,
        explanations=compat.get("explanations"),
        overlap_skills=overlap,
        accommodations=compat.get("accommodations"),
    )
    notes = build_notes(metrics, facts, drafts)

    lines = []
    lines.append(f"# Why-matched bake-off — {datetime.now():%Y-%m-%d %H:%M}")
    lines.append("")
    lines.append(f"Real user: **{user.get('name')}** | Real job: **{job.get('job_title')} at {job.get('employer_name')}**")
    lines.append(f"Metrics: {json.dumps({k: round(v, 1) for k, v in metrics.items()})}")
    lines.append(f"Threads: {args.threads} | Runs per model: {args.runs}")
    lines.append("")
    lines.append("**Deterministic plain drafts (instant fallback layer):**")
    for label in ("compatibility", "performance", "advice", "challenges"):
        lines.append(f"- **{label}**: {drafts[label]}")
    lines.append("")

    print("\n=== DETERMINISTIC PLAIN DRAFTS (instant fallback, built from verified verdicts) ===")
    for label in ("compatibility", "performance", "advice", "challenges"):
        print(f"[{label.upper()}] {drafts[label]}")

    models = find_models()
    print(f"\n[bench] found {len(models)} GGUF model(s)")
    for path in models:
        name = os.path.basename(path)
        size_mb = os.path.getsize(path) / (1024 * 1024)
        print(f"\n=== MODEL: {name} ({size_mb:.0f} MB) ===", flush=True)
        lines.append(f"## {name} ({size_mb:.0f} MB)")

        t0 = time.perf_counter()
        try:
            llm = load_llm(path, n_ctx=2048, n_threads=args.threads)
        except Exception as e:
            print(f"LOAD FAILED: {type(e).__name__}: {e}")
            lines.append(f"- ❌ **LOAD FAILED**: `{type(e).__name__}: {e}`")
            lines.append("")
            continue
        load_s = time.perf_counter() - t0
        print(f"load: {load_s:.1f}s", flush=True)
        lines.append(f"- load: {load_s:.1f}s")

        for run in range(args.runs):
            report, meta = generate_why_matched(
                llm,
                user.get("name") or "User",
                job["job_title"],
                job["employer_name"],
                metrics,
                facts,
                explanations=compat.get("explanations"),
                overlap_skills=overlap,
                accommodations=compat.get("accommodations"),
            )
            status = f"run {run + 1}: {meta.get('seconds')}s, {meta.get('tokens')} tok, {meta.get('tok_per_s')} tok/s, fallbacks={meta.get('fallbacks')} {meta.get('details')}"
            print(status, flush=True)
            lines.append(f"- {status}")
            if run == args.runs - 1:
                lines.append("")
                for key in ("compatibility", "performance", "advice", "challenges"):
                    print(f"\n[{key.upper()}] {report[key]}")
                    lines.append(f"**{key}**: {report[key]}")
                lines.append(f"\n_generated_by: {report.get('generated_by')}_")

        del llm
        lines.append("")

    out = os.path.join(REPO, "tests", "why_matched_bench_results.md")
    with open(out, "a", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n\n")
    print(f"\n[bench] results appended to {out}")


if __name__ == "__main__":
    main()
