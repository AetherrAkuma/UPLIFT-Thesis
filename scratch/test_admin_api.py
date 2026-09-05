import urllib.request
import urllib.error
import json

BASE = "http://127.0.0.1:8000/api"

def post_json(url, data):
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read().decode('utf-8'))

def get_auth(url, token):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read().decode('utf-8'))

# Step 1: Login
print("=== Step 1: Login ===")
try:
    login = post_json(f"{BASE}/auth/login", {"email": "admin@uplift.com", "password": "admin123"})
    token = login['token']
    print(f"Login OK. Token: {token[:30]}...")
    print(f"User: {login['user']}")
except Exception as e:
    print(f"Login FAILED: {e}")
    exit()

# Step 2: /auth/me
print("\n=== Step 2: /auth/me ===")
try:
    me = get_auth(f"{BASE}/auth/me", token)
    print(f"me: {me}")
except Exception as e:
    print(f"auth/me FAILED: {e}")

# Step 3: /admin/system-info
print("\n=== Step 3: /admin/system-info ===")
try:
    stats = get_auth(f"{BASE}/admin/system-info", token)
    print(f"stats: {stats}")
except Exception as e:
    print(f"system-info FAILED: {e}")

# Step 4: /admin/logs
print("\n=== Step 4: /admin/logs ===")
try:
    logs = get_auth(f"{BASE}/admin/logs", token)
    print(f"logs count: {len(logs)}")
    if logs:
        print(f"first log: {logs[0]}")
except Exception as e:
    print(f"logs FAILED: {e}")

# Step 5: /admin/employers/pending
print("\n=== Step 5: /admin/employers/pending ===")
try:
    emps = get_auth(f"{BASE}/admin/employers/pending", token)
    print(f"pending employers: {emps}")
except Exception as e:
    print(f"pending employers FAILED: {e}")
