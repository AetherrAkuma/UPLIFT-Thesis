import sys
import os
import json
import asyncio

# Adjust path to find server module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import server
from server import pwd_suitability_match, SearchRequest, get_db_connection

async def run_test():
    print("Connecting to database to find a test PWD user...")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, role FROM users WHERE role = 'user' LIMIT 1")
    user_row = cursor.fetchone()
    conn.close()
    
    if not user_row:
        print("ERROR: No user with role 'user' found in the database. Please register/seed users first.")
        return
        
    user_id, name, email, role = user_row
    print(f"Found test user: {name} (ID: {user_id}, Email: {email})")
    
    # Instantiate search request
    req = SearchRequest(search_query="office work", use_profile_context=True)
    
    # Mock user dict passed to endpoint dependency
    mock_user = {"id": user_id, "email": email, "name": name, "role": role}
    
    print("\nTriggering pwd_suitability_match endpoint...")
    try:
        response = await pwd_suitability_match(req, user=mock_user)
        print("\n=== RESPONSE RECEIVED ===")
        print(json.dumps(response, indent=2, default=str))
    except Exception as e:
        print(f"\nENDPOINT CRASHED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_test())
