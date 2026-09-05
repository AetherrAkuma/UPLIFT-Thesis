import urllib.request
import urllib.error
import json
import base64

# Decode the JWT token from localStorage to inspect it
# (Token must be pasted here - just decode without verification to see expiry)

TOKEN = input("Paste your upliftToken from localStorage: ").strip()

if not TOKEN:
    print("No token provided")
    exit()

# Decode JWT payload (no verification)
parts = TOKEN.split('.')
if len(parts) != 3:
    print("Invalid JWT format")
    exit()

payload_b64 = parts[1]
# Add padding
payload_b64 += '=' * (4 - len(payload_b64) % 4)
try:
    payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    print("\n=== JWT PAYLOAD ===")
    print(json.dumps(payload, indent=2))
    
    import time
    exp = payload.get('exp', 0)
    now = time.time()
    if exp < now:
        print(f"\nTOKEN IS EXPIRED! Expired {(now - exp)/60:.1f} minutes ago")
    else:
        print(f"\nToken is VALID. Expires in {(exp - now)/3600:.1f} hours")
except Exception as e:
    print(f"Failed to decode: {e}")

# Now test the endpoint with this token
print("\n=== Testing /api/auth/me with this token ===")
url = "http://127.0.0.1:8000/api/auth/me"
try:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req, timeout=10) as response:
        body = response.read().decode('utf-8')
        print(f"SUCCESS (200): {body[:200]}")
except urllib.error.HTTPError as e:
    print(f"HTTPError {e.code}: {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Request failed: {e}")
