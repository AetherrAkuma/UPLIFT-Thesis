import requests
import json

url = "http://127.0.0.1:8000/api/pwd/match"
data = {
    "name": "Test User",
    "disability_types": ["Physical - Wheelchair User"],
    "physical_capabilities": "Limited walking, strong upper body",
    "skills": "computer, typing, data entry",
    "preferred_intensity": "Low",
    "requires_flexibility": True
}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
