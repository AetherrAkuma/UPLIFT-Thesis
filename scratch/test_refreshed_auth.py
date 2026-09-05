import jwt
from datetime import datetime, timedelta

SECRET_KEYS = [
    "uplift_super_secret_key_v1",
    "uplift-thesis-secret-key-2026-32bytes-long!!",
    "uplift-thesis-secret-key-32bytes!!",
]
ALGORITHM = "HS256"

def create_access_token(data: dict):
    to_encode = data.copy()
    if "id" in to_encode and "sub" not in to_encode:
        to_encode["sub"] = to_encode["id"]
        to_encode.pop("id", None)
    expire = datetime.utcnow() + timedelta(days=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEYS[-1], algorithm=ALGORITHM)

def verify_token(token):
    for key in SECRET_KEYS:
        try:
            payload = jwt.decode(token, key, algorithms=[ALGORITHM])
            user_id = payload.get("sub") or payload.get("id")
            return {"status": "valid", "user_id": user_id, "payload": payload}
        except jwt.ExpiredSignatureError:
            return {"status": "expired"}
        except jwt.InvalidTokenError as e:
            last_err = e
            continue
    return {"status": "invalid", "error": str(last_err)}

# Test
user_data = {"id": "test-uuid-1234", "email": "test@uplift.com", "name": "Test User", "role": "user"}
token = create_access_token(user_data)
print("Generated Token:", token)
result = verify_token(token)
print("Verification Result:", result)

# Now test refresh flow (what /api/auth/me does)
refreshed_user = {
    "id": result["user_id"],
    "email": result["payload"].get("email"),
    "name": result["payload"].get("name"),
    "role": result["payload"].get("role")
}
refreshed_token = create_access_token(refreshed_user)
print("Refreshed Token:", refreshed_token)
refreshed_result = verify_token(refreshed_token)
print("Refreshed Verification Result:", refreshed_result)
