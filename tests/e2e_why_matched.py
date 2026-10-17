# ==========================================
# tests/e2e_why_matched.py — Real end-to-end test of "Why matched?"
# ==========================================
# Starts the real FastAPI server on 127.0.0.1:8010 (NOT port 8000, so the
# public Cloudflare tunnel stays untouched), authenticates as a REAL PWD user
# from the database, calls GET /api/pwd/job-analysis/{job_id} for a REAL job,
# and reports REAL latencies:
#   1. COLD  — cache row deleted on purpose, so the endpoint must compute the
#              deterministic facts + grounded generation and store the result.
#   2. WARM  — immediate repeat: must be served from the ai_reports DB cache.
#   3. WARM2 — one more repeat for stability.
# It also dumps the stored generation meta (model, seconds, tokens, fallbacks)
# straight from the ai_reports table.
#
# Usage:
#   .venv\Scripts\python.exe tests/e2e_why_matched.py

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone

import psycopg2
import requests
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO)
os.chdir(REPO)
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
load_dotenv(os.path.join(REPO, ".env"))

PORT = 8010
BASE = f"http://127.0.0.1:{PORT}"
# Same signing key used by server.py's create_access_token (current key)
JWT_SECRET = "uplift-thesis-secret-key-32bytes!!"


def db_conn():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME", "uplift"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )


def get_real_user_and_job():
    conn = db_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT id, name, email FROM users WHERE role='user' AND disability_profile IS NOT NULL "
        "AND disability_profile <> '' ORDER BY created_at LIMIT 1"
    )
    user = dict(cur.fetchone())
    cur.execute(
        "SELECT id, job_title, employer_name FROM jobs WHERE status='approved' "
        "ORDER BY id LIMIT 1"
    )
    job = dict(cur.fetchone())
    conn.close()
    return user, job


def clear_cache_rows(user_id, job_id):
    conn = db_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM ai_reports WHERE user_id = %s AND job_id = %s", (user_id, job_id))
    deleted = cur.rowcount
    conn.commit()
    conn.close()
    return deleted


def read_cache_meta(user_id, job_id):
    conn = db_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT fingerprint, meta, created_at FROM ai_reports WHERE user_id = %s AND job_id = %s "
        "ORDER BY created_at DESC LIMIT 1",
        (user_id, job_id),
    )
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def make_token(user):
    import jwt

    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "role": "user",
        "exp": datetime.now(timezone.utc) + timedelta(hours=2),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def wait_for_server(timeout_s=240):
    t0 = time.perf_counter()
    while time.perf_counter() - t0 < timeout_s:
        try:
            r = requests.get(f"{BASE}/api/schools?q=", timeout=2)
            if r.status_code == 200:
                return time.perf_counter() - t0
        except requests.RequestException:
            pass
        time.sleep(2)
    raise TimeoutError("server did not become ready in time")


def main():
    user, job = get_real_user_and_job()
    print(f"[e2e] real user: {user['name']} ({user['id']})")
    print(f"[e2e] real job : {job['job_title']} at {job['employer_name']} ({job['id']})")

    token = make_token(user)
    env = os.environ.copy()
    env["WHY_MATCHED_THREADS"] = env.get("WHY_MATCHED_THREADS", "2")

    print("[e2e] starting uvicorn on 127.0.0.1:8010 (public tunnel untouched)...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", str(PORT)],
        cwd=REPO,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    try:
        boot = wait_for_server()
        print(f"[e2e] server ready in {boot:.1f}s")
        time.sleep(1)

        deleted = clear_cache_rows(user["id"], job["id"])
        print(f"[e2e] cleared {deleted} cache row(s) for this pair to force a COLD run")

        url = f"{BASE}/api/pwd/job-analysis/{job['id']}"
        headers = {"Authorization": f"Bearer {token}"}

        print("\n[e2e] >>> CALL 1 (COLD: deterministic facts + grounded generation + cache store)")
        t0 = time.perf_counter()
        r = requests.get(url, headers=headers, timeout=300)
        first = time.perf_counter() - t0
        print(f"[e2e] HTTP {r.status_code} in {first:.1f}s")
        r.raise_for_status()
        data = r.json()

        print("\n=== analysis (the three sidebar cards, as served) ===")
        for key in ("compatibility", "performance", "advice", "challenges"):
            print(f"\n[{key.upper()}]\n{data['analysis'].get(key, '')}")
        print(f"\n[analysis.generated_by] {data['analysis'].get('generated_by')}")

        meta_row = read_cache_meta(user["id"], job["id"])
        if meta_row:
            print(f"[e2e] stored cache meta: {json.dumps(meta_row.get('meta'), default=str)}")
        else:
            print("[e2e] WARNING: no cache row was stored after the cold call")

        print("\n[e2e] >>> CALL 2 (WARM: DB cache hit — panel demo path)")
        t0 = time.perf_counter()
        r2 = requests.get(url, headers=headers, timeout=300)
        second = time.perf_counter() - t0
        print(f"[e2e] HTTP {r2.status_code} in {second:.1f}s")
        r2.raise_for_status()

        print("\n[e2e] >>> CALL 3 (WARM repeat, stability check)")
        t0 = time.perf_counter()
        r3 = requests.get(url, headers=headers, timeout=300)
        third = time.perf_counter() - t0
        print(f"[e2e] HTTP {r3.status_code} in {third:.1f}s")
        r3.raise_for_status()

        print("\n=== deterministic layer (unchanged, still the source of truth) ===")
        si = data.get("suitability_index")
        print(f"suitability_index overall: {json.dumps(si.get('overall')) if isinstance(si, dict) else si}")
        print(f"explanations count: {len(data.get('explanations', []))}")
        print(f"plain_barriers: {json.dumps(data.get('plain_barriers', []), ensure_ascii=False)}")

        print(f"\n[e2e] RESULT: cold={first:.1f}s, warm={second:.2f}s, warm2={third:.2f}s")
        print("[e2e] note: the sidebar also caches client-side, so repeat views render instantly.")

        with open(os.path.join(REPO, "tests", "e2e_why_matched_results.json"), "w", encoding="utf-8") as fh:
            json.dump(
                {
                    "user": f"{user['name']} ({user['id']})",
                    "job": f"{job['job_title']} at {job['employer_name']}",
                    "first_call_cold_seconds": round(first, 2),
                    "second_call_warm_seconds": round(second, 2),
                    "third_call_warm_seconds": round(third, 2),
                    "analysis": data.get("analysis"),
                    "stored_meta": meta_row.get("meta") if meta_row else None,
                    "fingerprint": meta_row.get("fingerprint") if meta_row else None,
                },
                fh,
                indent=2,
                ensure_ascii=False,
                default=str,
            )
        print("[e2e] saved tests/e2e_why_matched_results.json")
    finally:
        print("[e2e] stopping test server...")
        proc.terminate()
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.kill()
        out, _ = proc.communicate()
        tail = "\n".join((out or "").splitlines()[-25:])
        print("[e2e] --- server output tail ---")
        print(tail)


if __name__ == "__main__":
    main()
