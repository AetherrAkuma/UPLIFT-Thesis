import sys
import os
import json
import asyncio

# Adjust path to find server module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import server
from server import get_job_analysis, get_db_connection

async def run_test():
    print("Connecting to database...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get a test user
    cursor.execute("SELECT id, name, email, role FROM users WHERE role = 'user' LIMIT 1")
    user_row = cursor.fetchone()
    
    # Get a test approved job
    cursor.execute("SELECT id, job_title FROM jobs WHERE status = 'approved' LIMIT 1")
    job_row = cursor.fetchone()
    
    conn.close()
    
    if not user_row or not job_row:
        print("ERROR: User or Job missing in database.")
        return
        
    user_id, name, email, role = user_row
    job_id, job_title = job_row
    
    print(f"Test User: {name} (ID: {user_id})")
    print(f"Test Job: {job_title} (ID: {job_id})")
    
    # Mock user object passed to FastAPI Depends
    mock_user = {"id": user_id, "email": email, "name": name, "role": role}
    
    print("\nTriggering get_job_analysis endpoint...")
    try:
        response = await get_job_analysis(job_id, user=mock_user)
        print("\n=== JOB ANALYSIS RESPONSE ===")
        print(json.dumps(response, indent=2, default=str))
    except Exception as e:
        print(f"\nENDPOINT CRASHED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_test())
