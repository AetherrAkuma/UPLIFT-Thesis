import psycopg2
import json

DB_URI = "postgresql://postgres:yuichirokanade@localhost:5432/uplift"

def inspect_jobs():
    try:
        conn = psycopg2.connect(DB_URI)
    except Exception as e:
        print(f"Connection failed: {e}")
        return
        
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
            
            # Since register_vector wasn't called here, it will be a string or whatever PG returns.
            # Let's see what register_vector does too:
            # Let's check with and without register_vector.
            
            # Test json.loads logic
            try:
                if isinstance(emb, str):
                    loaded = json.loads(emb)
                    print(f"  As string: json.loads succeeded. Loaded type: {type(loaded)}, length: {len(loaded)}")
                elif isinstance(emb, list):
                    print(f"  As list: length: {len(emb)}")
                else:
                    print(f"  Other type: {type(emb)}")
            except Exception as e:
                print(f"  json.loads FAILED: {e}")
                
    # Now let's try with pgvector register_vector
    print("\n--- Testing with pgvector register_vector ---")
    try:
        from pgvector.psycopg2 import register_vector
        register_vector(conn)
        cursor2 = conn.cursor()
        cursor2.execute("SELECT id, job_title, embedding FROM jobs WHERE status = 'approved' AND embedding IS NOT NULL LIMIT 1")
        row = cursor2.fetchone()
        if row:
            job_id, title, emb = row
            print(f"Job: {title}")
            print(f"Type of embedding with register_vector: {type(emb)}")
            print(f"Is it numpy array? {type(emb).__name__}")
            try:
                # If server.py does json.loads on a numpy array, it will fail:
                loaded = json.loads(emb)
                print("json.loads succeeded on registered vector!")
            except Exception as e:
                print(f"json.loads FAILED on registered vector: {e}")
    except Exception as e:
        print(f"pgvector check failed: {e}")

    conn.close()

if __name__ == "__main__":
    inspect_jobs()
