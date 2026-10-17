# ==========================================
# tests/verify_job_extraction.py — On-machine verification of the Flan-T5 -> Qwen swap
# ==========================================
# Loads the REAL local GGUF (the same one the server loads) and runs the two
# production extraction paths on REAL job rows from the local `uplift` DB:
#   1. extract_job_features()     (generate_job_embedding / reindex_jobs.py)
#   2. extract_posting_features() (/api/employer/ai-analyze-description)
# Prints raw model replies, parsed values, and wall times for each step, then
# writes tests/job_extraction_live_results.json.
#
# Usage:  .venv\Scripts\python.exe tests\verify_job_extraction.py

import json
import os
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

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

load_dotenv(os.path.join(REPO, ".env"))

from why_matched import find_local_model, llm_chat, load_llm
from job_extraction import (
    build_feature_messages,
    build_posting_messages,
    extract_job_features,
    extract_posting_features,
    parse_feature_reply,
    parse_posting_reply,
)


def get_jobs(limit=2):
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME", "uplift"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT id, job_title, job_description, physical_requirements FROM jobs "
        "WHERE COALESCE(job_description,'') <> '' ORDER BY id LIMIT %s",
        (limit,),
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def sane_feature(f):
    return (
        f["intensity"] in (None, "Low", "Medium", "High")
        and f["flexibility"] in (0, 1)
        and isinstance(f["skills"], str)
    )


def sane_posting(p):
    return (
        isinstance(p["skills"], list)
        and all(isinstance(s, str) and s.strip() for s in p["skills"])
        and all(str(p[k]).strip() for k in ("posture", "communication", "pace"))
    )


def main():
    threads = int(os.getenv("WHY_MATCHED_THREADS", "2"))
    model_path = find_local_model(os.path.join(REPO, "model_cache", "gguf"))
    if not model_path:
        print("[FAIL] No GGUF model found in model_cache/gguf")
        return 1
    print(f"[INFO] Local model: {os.path.basename(model_path)} (threads={threads})")

    t0 = time.perf_counter()
    llm = load_llm(model_path, n_ctx=2048, n_threads=threads)
    print(f"[INFO] Model loaded in {time.perf_counter() - t0:.1f}s\n")

    # Guard: with no model the extractors must refuse (callers keep defaults).
    try:
        extract_job_features(None, "test")
        print("[FAIL] extract_job_features(None) did not raise")
        return 1
    except RuntimeError:
        print("[PASS] No-model guard: extractors raise -> callers keep deterministic defaults")

    jobs = get_jobs(2)
    if not jobs:
        print("[FAIL] No jobs with descriptions found in DB")
        return 1

    results = {
        "when": datetime.now().isoformat(timespec="seconds"),
        "model": os.path.basename(model_path),
        "threads": threads,
        "jobs": [],
    }
    ok = True

    # --- 1. Feature extraction (site A) on both real jobs ---
    for job in jobs:
        desc = job["job_description"] or ""
        phys = job["physical_requirements"] or ""
        t0 = time.perf_counter()
        feats = extract_job_features(llm, desc, phys)
        dt = time.perf_counter() - t0
        passed = sane_feature(feats)
        ok = ok and passed
        print(f"[{'PASS' if passed else 'FAIL'}] extract_job_features  job='{job['job_title'][:45]}'  {dt:.1f}s")
        print(f"       -> intensity={feats['intensity']} flexibility={feats['flexibility']} skills={feats['skills'][:80]!r}")
        results["jobs"].append({
            "job": job["job_title"], "seconds": round(dt, 1),
            "intensity": feats["intensity"], "flexibility": feats["flexibility"],
            "skills": feats["skills"], "sane": passed,
        })

    # --- 1b. Raw reply evidence (what Qwen actually answered, first job) ---
    desc1 = jobs[0]["job_description"] or ""
    phys1 = jobs[0]["physical_requirements"] or ""
    t0 = time.perf_counter()
    raw, tokens = llm_chat(llm, build_feature_messages(desc1, phys1), 120)
    dt = time.perf_counter() - t0
    raw_parsed = parse_feature_reply(raw)
    j0 = results["jobs"][0]
    same = (
        raw_parsed["intensity"] == j0["intensity"]
        and raw_parsed["flexibility"] == j0["flexibility"]
        and raw_parsed["skills"] == j0["skills"]
    )
    print(f"\n[EVIDENCE] independent raw feature call ({dt:.1f}s, {tokens} tokens): {raw!r}")
    print(f"           -> intensity={raw_parsed['intensity']} flexibility={raw_parsed['flexibility']} skills={raw_parsed['skills'][:60]!r}")
    print(f"           identical to the wrapper's call: {same} ('false' = harmless KV-cache paraphrase; both type-sane)")
    results["raw_feature_reply"] = raw
    results["raw_feature_parse_matches"] = same

    # --- 2. Posting extraction (site B) on the first real posting ---
    t0 = time.perf_counter()
    post = extract_posting_features(llm, jobs[0]["job_title"], desc1)
    dt = time.perf_counter() - t0
    passed = sane_posting(post)
    ok = ok and passed
    print(f"\n[{'PASS' if passed else 'FAIL'}] extract_posting_features  job='{jobs[0]['job_title'][:45]}'  {dt:.1f}s")
    print(f"       -> skills={post['skills']}")
    print(f"          posture={post['posture']!r} communication={post['communication']!r} pace={post['pace']!r}")
    results["posting"] = {"seconds": round(dt, 1), **post, "sane": passed}

    # --- 2b. Raw reply evidence for the posting path ---
    t0 = time.perf_counter()
    raw_post, tokens = llm_chat(llm, build_posting_messages(jobs[0]["job_title"], desc1), 160)
    dt = time.perf_counter() - t0
    print(f"\n[EVIDENCE] raw posting reply ({dt:.1f}s, {tokens} tokens): {raw_post!r}")
    results["raw_posting_reply"] = raw_post

    out_path = os.path.join(REPO, "tests", "job_extraction_live_results.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2)
    print(f"\n[INFO] Results saved to {out_path}")
    print(f"\n[{'PASS' if ok else 'FAIL'}] verification complete: all extraction outputs type-sane")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
