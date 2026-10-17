# ==========================================
# prewarm_reports.py — Pre-generate "Why matched?" reports
# ==========================================
# Generates and stores grounded reports for (PWD user x approved job) pairs
# through the EXACT production path (server.get_job_analysis) — the same
# function the /api/pwd/job-analysis/{job_id} endpoint calls.  After a
# pre-warm, every demo/panel view of these pairs is served from the DB cache
# in ~1s instead of waiting for cold generation (~20-30s on weak CPUs).
#
# Run it whenever profiles or jobs change, or once before a demo/panel test.
#
# Usage:
#   .venv\Scripts\python.exe prewarm_reports.py                 (all PWD users x approved jobs)
#   .venv\Scripts\python.exe prewarm_reports.py --user <USER_ID> (one user)
#   .venv\Scripts\python.exe prewarm_reports.py --limit 2       (first N pairs, for a smoke test)

import argparse
import os
import sys
import time

REPO = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, REPO)
os.chdir(REPO)
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

load_dotenv(os.path.join(REPO, ".env"))

import server  # noqa: E402  (imports load all engines incl. the Why-matched GGUF)


def get_pairs(user_id=None):
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME", "uplift"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )
    cur = conn.cursor(cursor_factory=RealDictCursor)
    if user_id:
        cur.execute(
            "SELECT id, name FROM users WHERE id = %s AND role='user'", (user_id,)
        )
    else:
        cur.execute(
            "SELECT id, name FROM users WHERE role='user' AND disability_profile IS NOT NULL "
            "AND disability_profile <> '' ORDER BY created_at"
        )
    users = [dict(r) for r in cur.fetchall()]
    cur.execute(
        "SELECT id, job_title, employer_name FROM jobs WHERE status='approved' ORDER BY id"
    )
    jobs = [dict(r) for r in cur.fetchall()]
    conn.close()
    return [(u, j) for u in users for j in jobs]


def main():
    parser = argparse.ArgumentParser(description="Pre-warm Why-matched reports into the DB cache")
    parser.add_argument("--user", default=None, help="only this user id")
    parser.add_argument("--limit", type=int, default=0, help="stop after N pairs (0 = all)")
    args = parser.parse_args()

    # Make sure the cache table exists even if the API has not booted yet.
    try:
        server.init_db()
    except Exception as e:
        print(f"[prewarm] init_db warning: {e}")

    pairs = get_pairs(args.user)
    if args.limit:
        pairs = pairs[: args.limit]
    if not pairs:
        print("[prewarm] no (user, job) pairs found")
        return

    print(f"[prewarm] warming {len(pairs)} pair(s) through the production endpoint function...")
    done = 0
    generated = 0
    for user, job in pairs:
        t0 = time.perf_counter()
        try:
            result = server.get_job_analysis(job["id"], {"id": user["id"]})
            dt = time.perf_counter() - t0
            gb = result.get("analysis", {}).get("generated_by")
            if gb == "deterministic":
                generated += 1
            print(f"  [{dt:5.1f}s] {user['name']} x {job['job_title']} -> generated_by={gb}")
        except Exception as e:
            print(f"  [FAIL ] {user['name']} x {job['job_title']}: {type(e).__name__}: {e}")
        done += 1

    # Final verification: one repeat call must now be a fast cache hit.
    if done:
        u, j = pairs[0]
        t0 = time.perf_counter()
        server.get_job_analysis(j["id"], {"id": u["id"]})
        warm = time.perf_counter() - t0
        print(f"[prewarm] verification repeat call: {warm:.2f}s (cache hit expected)")
    print(f"[prewarm] done: {done} pair(s) processed")


if __name__ == "__main__":
    main()
