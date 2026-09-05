import sys
import os
import json

# Adjust path to find server module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from server import get_db_connection

def inspect_jobs():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check count of approved jobs
    cursor.execute("SELECT COUNT(*) FROM jobs WHERE status = 'approved'")
    approved_count = cursor.fetchone()[0]
    print(f"Total approved jobs: {approved_count}")

    # Check count of jobs with embeddings
    cursor.execute("SELECT COUNT(*) FROM jobs WHERE status = 'approved' AND embedding IS NOT NULL")
    emb_count = cursor.fetchone()[0]
    print(f"Approved jobs with non-null embedding: {emb_count}")

    if emb_count > 0:
        cursor.execute("SELECT id, job_title, embedding FROM jobs WHERE status = 'approved' AND embedding IS NOT NULL LIMIT 3")
        rows = cursor.fetchall()
        for i, row in enumerate(rows):
            job_id, title, emb = row
            print(f"\nJob {i+1}: ID={job_id}, Title='{title}'")
            print(f"  Type of embedding: {type(emb)}")
            if hasattr(emb, '__len__'):
                print(f"  Length of embedding: {len(emb)}")
                print(f"  First 5 elements: {emb[:5]}")
            else:
                print(f"  Value: {repr(emb)}")
                
            # Test json.loads logic
            try:
                # If we do json.loads on it, does it work?
                if isinstance(emb, str):
                    loaded = json.loads(emb)
                    print(f"  json.loads succeeded. Loaded type: {type(loaded)}, length: {len(loaded)}")
                else:
                    print("  Skipping json.loads because embedding is not a string.")
            except Exception as e:
                print(f"  json.loads FAILED: {e}")
                
    conn.close()

if __name__ == "__main__":
    inspect_jobs()
