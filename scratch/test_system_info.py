import sys
import os
import json
import asyncio

# Adjust path to find server module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import server
from server import get_system_info

async def run_test():
    print("Testing get_system_info endpoint...")
    try:
        # Mock admin user context
        mock_admin = {"id": "admin-1", "email": "admin@example.com", "role": "admin"}
        response = await get_system_info(user=mock_admin)
        print("\n=== SYSTEM INFO RESPONSE ===")
        print(json.dumps(response, indent=2))
    except Exception as e:
        print(f"\nENDPOINT CRASHED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_test())
