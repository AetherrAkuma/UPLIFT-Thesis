import sys
import os
import json
import numpy as np

# Adjust path to find server module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from server import get_db_connection

def test_query():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Let's mock a query vector of 384 dimensions
    mock_vector = [0.0] * 384
    mock_vector[0] = 1.0 # set first element to 1.0
    
    try:
        # We try querying using json.dumps and ::vector cast
        cursor.execute("""
            SELECT id, job_title, 1 - (embedding <=> %s::vector) AS cos_sim
            FROM jobs 
            WHERE status = 'approved' AND embedding IS NOT NULL
            ORDER BY embedding <=> %s::vector ASC
            LIMIT 3
        """, (json.dumps(mock_vector), json.dumps(mock_vector)))
        
        rows = cursor.fetchall()
        print(f"Query succeeded. Found {len(rows)} matching jobs.")
        for row in rows:
            print(f"  Job ID: {row[0]}, Title: '{row[1]}', Cosine Similarity: {row[2]}")
            
    except Exception as e:
        print(f"Query failed: {e}")
        
    conn.close()

if __name__ == "__main__":
    test_query()
